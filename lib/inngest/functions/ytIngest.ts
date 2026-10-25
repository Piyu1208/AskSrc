import { inngest } from "../client";
import { NonRetriableError } from "inngest";
import {
    YoutubeTranscript,
    YoutubeTranscriptDisabledError,
    YoutubeTranscriptNotAvailableError,
    YoutubeTranscriptNotAvailableLanguageError,
    YoutubeTranscriptVideoUnavailableError,
} from "youtube-transcript";
import { chunkTranscript, type TranscriptItem } from "@/lib/chunk";
import { embedTexts } from "@/lib/rag/embeddings";
import {
    qdrant,
    ensureCollection,
    COLLECTION_NAME,
} from "@/lib/rag/qdrant";
import { v5 as uuidv5 } from "uuid";
import { updateSource } from "@/lib/sources";

/**
1. Fetch + chunk the transcript, and fetch the title, in parallel.
2. Ensure the Qdrant collection exists.
3. Embed + upsert chunks in batches.
4. Update the MongoDB source (chunk count + completed) in one query.
5. If indexing fails permanently, mark the source as failed.
**/

type YtIngestEvent = {
    userId: string;
    sourceId: string;
    videoId: string;
    sourceUrl: string;
};

const EMBED_BATCH_SIZE = 64; // chunks embedded + upserted per step
const QDRANT_NAMESPACE = "431f2dc2-d813-4182-9577-4d06715e1cf9";


async function fetchYoutubeTitle(videoId: string): Promise<string> {
    const url = `https://www.youtube.com/watch?v=${videoId}`;
    const response = await fetch(
        `https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`,
    );

    if (!response.ok) {
        // 4xx (other than 429) means oEmbed isn't available for this video
        // (e.g. embedding disabled). The title is cosmetic, so don't fail the
        // whole ingestion over it.
        if (
            response.status >= 400 &&
            response.status < 500 &&
            response.status !== 429
        ) {
            return `YouTube video ${videoId}`;
        }
        // 429 / 5xx: transient, let Inngest retry.
        throw new Error(
            `Failed to fetch YouTube video title (HTTP ${response.status}).`,
        );
    }

    const data = (await response.json()) as { title?: string };

    console.log({
        videoId,
        requestedUrl: url,
        fetchedTitle: data.title,
    });
    return data.title?.trim() || `YouTube video ${videoId}`;
}



/** 
async function fetchYoutubeTitle(videoId: string): Promise<string> {
  const params = new URLSearchParams({
    part: "snippet",
    id: videoId,
    key: process.env.YOUTUBE_API_KEY!,
  });

  const response = await fetch(
    `https://www.googleapis.com/youtube/v3/videos?${params}`,
    { signal: AbortSignal.timeout(10_000) },
  );

  if (!response.ok) {
    throw new Error(
      `Failed to fetch YouTube title (HTTP ${response.status}).`,
    );
  }

  const data = (await response.json()) as {
    items?: { id: string; snippet?: { title?: string } }[];
  };

  const video = data.items?.[0];

  if (!video || video.id !== videoId || !video.snippet?.title) {
    throw new Error(`YouTube video metadata not found: ${videoId}`);
  }

  return video.snippet.title.trim();
}
**/

function createTimestampUrl(videoId: string, startTime: number): string {
    return `https://www.youtube.com/watch?v=${videoId}&t=${Math.floor(startTime)}s`;
}

export const ytIngest = inngest.createFunction(
    {
        id: "yt-ingest",
        name: "Youtube Ingest",
        triggers: { event: "app/yt-ingested" },

        // Runs only after the main function exhausts its retries.
        onFailure: async ({ event, error, step }) => {
            const { userId, sourceId } = event.data.event
                .data as YtIngestEvent;

            await step.run("mark-source-failed", async () => {
                await updateSource(sourceId, userId, "failed");
            });

            console.error("Youtube ingestion failed permanently:", {
                sourceId,
                error: error.message,
            });
        },
    },

    async ({ event, step }) => {
        const { sourceId, userId, videoId, sourceUrl } =
            event.data as YtIngestEvent;

        // Step 1 (parallel): transcript -> chunks, and title.
        // The raw transcript is NOT returned from its step, only the chunks, so
        // the stored step state stays as small as possible.
        const [chunks, title] = await Promise.all([
            step.run("fetch-and-chunk-transcript", async () => {
                let raw;
                try {
                    raw = await YoutubeTranscript.fetchTranscript(videoId);
                } catch (error) {
                    // No captions / private / removed video: retrying won't help.
                    if (
                        error instanceof YoutubeTranscriptDisabledError ||
                        error instanceof YoutubeTranscriptNotAvailableError ||
                        error instanceof YoutubeTranscriptNotAvailableLanguageError ||
                        error instanceof YoutubeTranscriptVideoUnavailableError
                    ) {
                        throw new NonRetriableError(error.message);
                    }
                    // Rate limiting / network errors: retryable.
                    throw error;
                }

                if (!raw || raw.length === 0) {
                    throw new NonRetriableError(
                        "No captions/transcript available for this video.",
                    );
                }

                // youtube-transcript returns integer milliseconds for most caption
                // tracks, but seconds (usually fractional) when it falls back to the
                // classic XML format. Detect that so timestamps aren't off by 1000x.
                const looksLikeSeconds = raw.some(
                    (item) =>
                        !Number.isInteger(item.offset) ||
                        !Number.isInteger(item.duration),
                );
                const divisor = looksLikeSeconds ? 1 : 1000;

                const items: TranscriptItem[] = raw.map((item) => ({
                    text: item.text,
                    start: item.offset / divisor,
                    duration: item.duration / divisor,
                }));

                const result = chunkTranscript(items);

                if (result.length === 0) {
                    throw new NonRetriableError(
                        "Transcript produced no usable chunks.",
                    );
                }

                return result;
            }),

            step.run("fetch-title", async () => fetchYoutubeTitle(videoId)),
        ]);

        // Step 2: make sure the collection exists (idempotent).
        await step.run("ensure-qdrant-collection", async () => {
            await ensureCollection();
        });

        // Step 3: embed + upsert in batches.
        // Vectors are large, so they are never returned from a step (that would
        // hit Inngest's step output size limit on long videos). Each batch embeds
        // and writes to Qdrant inside the same step. Point IDs are deterministic
        // (uuidv5), so retries overwrite instead of creating duplicates.
        for (let i = 0; i < chunks.length; i += EMBED_BATCH_SIZE) {
            const batch = chunks.slice(i, i + EMBED_BATCH_SIZE);

            await step.run(`embed-and-upsert-${i}`, async () => {
                const vectors = await embedTexts(batch.map((c) => c.text));

                if (vectors.length !== batch.length) {
                    throw new Error(
                        `Embedding count (${vectors.length}) does not match chunk count (${batch.length}).`,
                    );
                }

                const points = batch.map((chunk, j) => {
                    const chunkIndex = i + j; // global index across the video
                    return {
                        id: uuidv5(`${sourceId}:${chunkIndex}`, QDRANT_NAMESPACE),
                        vector: vectors[j],
                        payload: {
                            userId,
                            sourceId,
                            sourceType: "youtube" as const,
                            sourceName: title,
                            sourceUrl,
                            videoId,
                            chunkIndex,
                            text: chunk.text,
                            startTime: chunk.startTime,
                            endTime: chunk.endTime,
                            timestampUrl: createTimestampUrl(videoId, chunk.startTime),
                        },
                    };
                });

                await qdrant.upsert(COLLECTION_NAME, { wait: true, points });
            });
        }

        // Step 4: chunk count + completed status in a single update, only after
        // every batch has been indexed.
        await step.run("finalize-source", async () => {
            const res = await updateSource(
                sourceId,
                userId,
                "completed",
                chunks.length,
                title
            );

            if (res.matchedCount === 0) {
                throw new NonRetriableError(
                    `Source ${sourceId} not found for user.`,
                );
            }
        });

        return { chunksIndexed: chunks.length };
    },
);