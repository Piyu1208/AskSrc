import { NextRequest, NextResponse } from "next/server";
import { YoutubeTranscript } from "youtube-transcript";
import { v4 as uuidv4 } from "uuid";

import {
  qdrant,
  ensureCollection,
  COLLECTION_NAME,
} from "@/lib/qdrant";

import { embedTexts } from "@/lib/embeddings";

import {
  chunkTranscript,
  type TranscriptItem,
} from "@/lib/chunk";

export const runtime = "nodejs";

function extractVideoId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=)([^&]+)/,
    /(?:youtu\.be\/)([^?]+)/,
    /(?:youtube\.com\/embed\/)([^?]+)/,
    /(?:youtube\.com\/shorts\/)([^?]+)/,
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);

    if (match) {
      return match[1];
    }
  }

  return null;
}

function createTimestampUrl(
  videoId: string,
  startTime: number
): string {
  return `https://www.youtube.com/watch?v=${videoId}&t=${Math.floor(
    startTime
  )}s`;
}

// POST /api/sources/youtube
// Body: { url: string }

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);
    const url = body?.url;

    // --------------------------------------------------
    // 1. Validate URL
    // --------------------------------------------------

    if (!url || typeof url !== "string") {
      return NextResponse.json(
        { error: "A valid 'url' field is required." },
        { status: 400 }
      );
    }

    // --------------------------------------------------
    // 2. Extract video ID
    // --------------------------------------------------

    const videoId = extractVideoId(url);

    if (!videoId) {
      return NextResponse.json(
        {
          error:
            "Could not parse a YouTube video ID from that URL.",
        },
        { status: 400 }
      );
    }

    // --------------------------------------------------
    // 3. Fetch captions
    // --------------------------------------------------

    const transcript = await YoutubeTranscript.fetchTranscript(
      videoId
    );

    if (!transcript || transcript.length === 0) {
      return NextResponse.json(
        {
          error:
            "No captions/transcript available for this video.",
        },
        { status: 422 }
      );
    }

    // Convert library format into our own format.
    const transcriptItems: TranscriptItem[] = transcript.map(
      (item) => ({
        text: item.text,
        start: item.offset / 1000,
        duration: item.duration / 1000,
      })
    );

    // --------------------------------------------------
    // 4. Normalize + timestamp-aware chunking
    // --------------------------------------------------

    const chunks = chunkTranscript(transcriptItems);

    if (chunks.length === 0) {
      return NextResponse.json(
        {
          error: "Transcript produced no usable chunks.",
        },
        { status: 422 }
      );
    }

    // --------------------------------------------------
    // 5. Generate embeddings
    // --------------------------------------------------

    const texts = chunks.map((chunk) => chunk.text);

    const vectors = await embedTexts(texts);

    if (vectors.length !== chunks.length) {
      throw new Error(
        "Embedding count does not match chunk count."
      );
    }

    // --------------------------------------------------
    // 6. Ensure Qdrant collection
    // --------------------------------------------------

    await ensureCollection();

    const sourceId = uuidv4();

    // --------------------------------------------------
    // 7. Create Qdrant points
    // --------------------------------------------------

    const points = chunks.map((chunk, index) => ({
      id: uuidv4(),

      vector: vectors[index],

      payload: {
        sourceId,
        sourceType: "youtube" as const,

        sourceUrl: url,

        videoId,

        chunkIndex: index,

        text: chunk.text,

        startTime: chunk.startTime,

        endTime: chunk.endTime,

        timestampUrl: createTimestampUrl(
          videoId,
          chunk.startTime
        ),
      },
    }));

    // --------------------------------------------------
    // 8. Store in Qdrant
    // --------------------------------------------------

    await qdrant.upsert(COLLECTION_NAME, {
      wait: true,
      points,
    });

    // --------------------------------------------------
    // 9. Return result
    // --------------------------------------------------

    return NextResponse.json({
      success: true,

      sourceId,

      sourceType: "youtube",

      videoId,

      chunksIndexed: chunks.length,
    });
  } catch (err: any) {
    console.error("YouTube ingestion error:", err);

    return NextResponse.json(
      {
        error:
          err?.message ||
          "Failed to process YouTube link.",
      },
      { status: 500 }
    );
  }
}