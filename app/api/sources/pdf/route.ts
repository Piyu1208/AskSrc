import { NextRequest, NextResponse } from "next/server";

import { v4 as uuidv4 } from "uuid";

import {
  qdrant,
  ensureCollection,
  COLLECTION_NAME,
} from "@/lib/qdrant";

import { embedTexts } from "@/lib/embeddings";

import { extractText } from "unpdf";

import { getSession } from "@/lib/get-session";
import { createSource } from "@/lib/sources";
import { getDb } from "@/lib/db";

export const runtime = "nodejs";

// --------------------------------------------------
// Types
// --------------------------------------------------

type PageChunk = {
  text: string;
  pageNumber: number;
};

// --------------------------------------------------
// Chunk a single page
// --------------------------------------------------

function chunkPage(
  text: string,
  pageNumber: number,
  chunkSize = 600,
  overlap = 50
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
    const end = Math.min(
      start + chunkSize,
      words.length
    );

    const chunk = words
      .slice(start, end)
      .join(" ");

    if (chunk.trim()) {
      chunks.push({
        text: chunk,
        pageNumber,
      });
    }

    if (end === words.length) {
      break;
    }

    start = end - overlap;
  }

  return chunks;
}

// --------------------------------------------------
// POST /api/sources/pdf
//
// Body: multipart/form-data
// field: file
// --------------------------------------------------

export async function POST(req: NextRequest) {
  try {
    // --------------------------------------------------
    // 1. Authenticate user
    // --------------------------------------------------

    const session = await getSession();

    if (!session) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const userId = session.user.id;

    // --------------------------------------------------
    // 2. Get uploaded file
    // --------------------------------------------------

    const formData = await req.formData();

    const pdfFile = formData.get("file");

    if (!(pdfFile instanceof File)) {
      return NextResponse.json(
        {
          error: "A PDF file is required.",
        },
        { status: 400 }
      );
    }

    // --------------------------------------------------
    // 3. Validate PDF
    // --------------------------------------------------

    if (pdfFile.type !== "application/pdf") {
      return NextResponse.json(
        {
          error: "Only PDF files are supported.",
        },
        { status: 400 }
      );
    }

    // --------------------------------------------------
    // 4. Read PDF
    // --------------------------------------------------

    const arrayBuffer = await pdfFile.arrayBuffer();

    const pdfData = new Uint8Array(arrayBuffer);

    // --------------------------------------------------
    // 5. Extract text page-by-page
    // --------------------------------------------------

    const { text, totalPages } = await extractText(
      pdfData,
      {
        mergePages: false,
      }
    );

    const allChunks: PageChunk[] = [];

    text.forEach((pageText, index) => {
      const pageChunks = chunkPage(
        pageText,
        index + 1
      );

      allChunks.push(...pageChunks);
    });

    // --------------------------------------------------
    // 6. Validate extracted text
    // --------------------------------------------------

    if (allChunks.length === 0) {
      return NextResponse.json(
        {
          error:
            "Could not extract any usable text from the PDF.",
        },
        { status: 422 }
      );
    }

    // --------------------------------------------------
    // 7. Generate embeddings
    // --------------------------------------------------

    const texts = allChunks.map(
      (chunk) => chunk.text
    );

    const vectors = await embedTexts(texts);

    if (vectors.length !== allChunks.length) {
      throw new Error(
        "Embedding count does not match chunk count."
      );
    }

    // --------------------------------------------------
    // 8. Create MongoDB source
    // --------------------------------------------------

    const source = await createSource(
      userId,
      pdfFile.name,
      "pdf"
    );

    const sourceId = source.id;



    const db = await getDb();


    try {

      // --------------------------------------------------
      // 9. Ensure Qdrant collection
      // --------------------------------------------------

      await ensureCollection();

      // --------------------------------------------------
      // 10. Create Qdrant points
      // --------------------------------------------------

      const points = allChunks.map(
        (chunk, index) => ({
          id: uuidv4(),

          vector: vectors[index],

          payload: {
            // Ownership
            userId,
            sourceId,

            // Source information
            sourceType: "pdf" as const,
            sourceName: pdfFile.name,

            // Chunk information
            chunkIndex: index,
            pageNumber: chunk.pageNumber,
            text: chunk.text,
          },
        })
      );

      // --------------------------------------------------
      // 11. Store in Qdrant
      // --------------------------------------------------

      await qdrant.upsert(COLLECTION_NAME, {
        wait: true,
        points,
      });
    } catch (error) {
      // Qdrant failed, so remove the Mongo source
      await db.collection("sources").deleteOne({
        id: sourceId,
        userId,
      });

      throw error;
    }


    // --------------------------------------------------
    // 12. Return result
    // --------------------------------------------------

    return NextResponse.json({
      success: true,
      sourceId,
      sourceType: "pdf",
      fileName: pdfFile.name,
      pages: totalPages,
      chunksIndexed: allChunks.length,
    });
  } catch (err: any) {
    console.error(
      "PDF ingestion error:",
      err
    );

    return NextResponse.json(
      {
        error:
          err?.message ||
          "Failed to process PDF.",
      },
      { status: 500 }
    );
  }
}