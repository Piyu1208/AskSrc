import { inngest } from "../client";
import { getDb } from "@/lib/db";
import { embedTexts } from "@/lib/rag/embeddings";
import { extractText } from "unpdf";
import { v5 as uuidv5 } from "uuid";
import {
  qdrant,
  ensureCollection,
  COLLECTION_NAME,
} from "@/lib/rag/qdrant";
import { downloadFromCloudinary } from "@/lib/cloudinary-download";
import { updateSource } from "@/lib/sources";

type PageChunk = {
  text: string;
  pageNumber: number;
};

type PdfIngestEvent = {
  userId: string;
  sourceId: string;
  fileName: string;
  cloudinaryPublicId: string;
};

const CHUNK_SIZE = 600; // words
const OVERLAP = 50; // words
const EMBED_BATCH_SIZE = 64; // chunks embedded + upserted per step
const QDRANT_NAMESPACE = "431f2dc2-d813-4182-9577-4d06715e1cf9";

function chunkPage(
  text: string,
  pageNumber: number,
  chunkSize = CHUNK_SIZE,
  overlap = OVERLAP,
): PageChunk[] {
  // Guard against an infinite loop if overlap >= chunkSize.
  const safeOverlap = Math.min(overlap, chunkSize - 1);

  const words = text.replace(/\s+/g, " ").trim().split(" ");

  if (words.length === 0 || words[0] === "") {
    return [];
  }

  const chunks: PageChunk[] = [];
  let start = 0;

  while (start < words.length) {
    const end = Math.min(start + chunkSize, words.length);
    const chunk = words.slice(start, end).join(" ");

    if (chunk.trim()) {
      chunks.push({ text: chunk, pageNumber });
    }

    if (end === words.length) break;
    start = end - safeOverlap;
  }

  return chunks;
}

export const pdfIngest = inngest.createFunction(
  {
    id: "pdf-ingest",
    name: "PDF Ingest",
    triggers: { event: "app/pdf.ingested" },

    // Runs only after the main function exhausts its retries.
    onFailure: async ({ event, error, step }) => {
      const { userId, sourceId } = event.data.event
        .data as PdfIngestEvent;

      await step.run("mark-source-failed", async () => {
        await updateSource(sourceId, userId, "failed");
      });

      console.error("PDF ingestion failed permanently:", {
        sourceId,
        error: error.message,
      });
    },
  },

  async ({ event, step }) => {
    const { userId, sourceId, fileName, cloudinaryPublicId } =
      event.data as PdfIngestEvent;

    // Step 1: download + extract + chunk.
    // Done in ONE step because step results are JSON-serialized between
    // steps: a raw PDF buffer can't be passed along, but the chunks can.
    const chunks: PageChunk[] = await step.run(
      "download-and-chunk",
      async () => {
        const buffer = await downloadFromCloudinary(cloudinaryPublicId);

        const { text: pages } = await extractText(
          new Uint8Array(buffer),
          { mergePages: false },
        );

        const allChunks: PageChunk[] = [];
        pages.forEach((pageText, index) => {
          allChunks.push(...chunkPage(pageText, index + 1));
        });

        if (allChunks.length === 0) {
          throw new Error(
            "Could not extract any usable text from the PDF.",
          );
        }

        return allChunks;
      },
    );

    // Step 2: make sure the collection exists (idempotent).
    await step.run("ensure-collection", async () => {
      await ensureCollection();
    });

    // Step 3: embed + upsert in batches.
    // Embedding vectors are large, so they are never returned from a step;
    // each batch embeds and writes to Qdrant within the same step.
    // Point IDs are deterministic (uuidv5), so retries just overwrite.
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
          const chunkIndex = i + j; // global index across the document
          return {
            id: uuidv5(`${sourceId}:${chunkIndex}`, QDRANT_NAMESPACE),
            vector: vectors[j],
            payload: {
              userId,
              sourceId,
              sourceType: "pdf" as const,
              sourceName: fileName,
              chunkIndex,
              pageNumber: chunk.pageNumber,
              text: chunk.text,
            },
          };
        });

        await qdrant.upsert(COLLECTION_NAME, { wait: true, points });
      });
    }

    // Step 4: chunk count + completed status in a single MongoDB update,
    // only after every batch has been indexed.
    await step.run("finalize-source", async () => {
      const res = await updateSource(
        sourceId, 
        userId, 
        "completed", 
        chunks.length
      );

      if (res.matchedCount === 0) {
        throw new Error(`Source ${sourceId} not found for user.`);
      }
    });

    return { chunksIndexed: chunks.length };
  },
);