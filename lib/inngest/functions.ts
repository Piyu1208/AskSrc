import { inngest } from "./client";
import { getDb } from "@/lib/db";
import { embedTexts } from "@/lib/rag/embeddings";
import { extractText } from "unpdf";
import { v4 as uuidv4 } from "uuid";
import {
  qdrant,
  ensureCollection,
  COLLECTION_NAME,
} from "@/lib/rag/qdrant";
import { downloadFromCloudinary } from "@/lib/cloudinary-download";

type PageChunk = {
  text: string;
  pageNumber: number;
};

const CHUNK_SIZE = 600;
const OVERLAP = 50;

function chunkPage(
  text: string,
  pageNumber: number,
  chunkSize = CHUNK_SIZE,
  overlap = OVERLAP,
): PageChunk[] {
  const words = text
    .replace(/\s+/g, " ")
    .trim()
    .split(" ");

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
    start = end - overlap;
  }

  return chunks;
}

export const pdfIngest = inngest.createFunction(
  {
    id: "pdf-ingest",
    name: "PDF Ingest",
    triggers: { event: "app/pdf.ingested" },
  },
  async ({ event, step }) => {
    const {
      userId,
      sourceId,
      fileName,
      cloudinaryPublicId,
    } = event.data as {
      userId: string;
      sourceId: string;
      fileName: string;
      cloudinaryPublicId: string;
    };

    return await step.run("process-pdf", async () => {
      const db = await getDb();

      // --------------------------------------------------
      // 1. Download PDF from Cloudinary
      // --------------------------------------------------
      const buffer = await downloadFromCloudinary(cloudinaryPublicId);

      // --------------------------------------------------
      // 2. Extract text page-by-page
      // --------------------------------------------------
      const pdfData = new Uint8Array(buffer);
      const { text } = await extractText(pdfData, {
        mergePages: false,
      });

      const allChunks: PageChunk[] = [];
      text.forEach((pageText, index) => {
        const pageChunks = chunkPage(pageText, index + 1);
        allChunks.push(...pageChunks);
      });

      if (allChunks.length === 0) {
        throw new Error("Could not extract any usable text from the PDF.");
      }

      // --------------------------------------------------
      // 3. Generate embeddings
      // --------------------------------------------------
      const texts = allChunks.map((chunk) => chunk.text);
      const vectors = await embedTexts(texts);

      if (vectors.length !== allChunks.length) {
        throw new Error("Embedding count does not match chunk count.");
      }

      // --------------------------------------------------
      // 4. Ensure Qdrant collection
      // --------------------------------------------------
      await ensureCollection();

      // --------------------------------------------------
      // 5. Create Qdrant points
      // --------------------------------------------------
      const points = allChunks.map((chunk, index) => ({
        id: uuidv4(),
        vector: vectors[index],
        payload: {
          userId,
          sourceId,
          sourceType: "pdf" as const,
          sourceName: fileName,
          chunkIndex: index,
          pageNumber: chunk.pageNumber,
          text: chunk.text,
        },
      }));

      // --------------------------------------------------
      // 6. Store in Qdrant
      // --------------------------------------------------
      await qdrant.upsert(COLLECTION_NAME, { wait: true, points });

      // --------------------------------------------------
      // 7. Update MongoDB source with chunk count
      // --------------------------------------------------
      await db.collection("sources").updateOne(
        { id: sourceId, userId },
        { $set: { chunks: allChunks.length } },
      );

      return { chunksIndexed: allChunks.length };
    });
  }
);