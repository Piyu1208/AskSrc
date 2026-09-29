import { Document } from "@langchain/core/documents";
import { qdrant, COLLECTION_NAME } from "../qdrant";
import { embedTexts } from "../embeddings";

type BaseMetadata = {
  userId: string;
  sourceId: string;
  chunkIndex: number;
  text: string;
};

type PDFMetadata = BaseMetadata & {
  sourceType: "pdf";
  sourceName: string;
  pageNumber: number;
};

type YouTubeMetadata = BaseMetadata & {
  sourceType: "youtube";
  sourceUrl: string;
  videoId: string;
  startTime: number;
  endTime: number;
  timestampUrl: string;
};

export type RAGMetadata = PDFMetadata | YouTubeMetadata;

export type RAGDocument = Document<RAGMetadata>;

const RETRIEVAL_K = 20;

export async function vectorSearch(
  queries: string[],
  userId: string,
  sourceId: string
): Promise<RAGDocument[]> {
  if (queries.length === 0) {
    return [];
  }

  const queryEmbeddings = await embedTexts(queries);

  const allDocs: RAGDocument[] = [];

  for (const queryVector of queryEmbeddings) {
    const searchResult = await qdrant.query(COLLECTION_NAME, {
      query: queryVector,
      limit: RETRIEVAL_K,
      with_payload: true,
      filter: {
        must: [
          {
            key: "userId",
            match: {
              value: userId,
            },
          },
          {
            key: "sourceId",
            match: {
              value: sourceId,
            },
          },
        ],
      },
    });

    for (const result of searchResult.points) {
      const payload = result.payload;

      if (!payload) continue;

      const { text, ...metadata } = payload;

      allDocs.push(
        new Document({
          pageContent: String(text ?? ""),
          metadata: metadata as RAGMetadata,
        })
      );
    }
  }

  const uniqueDocs = Array.from(
    new Map(
      allDocs.map((doc, index) => [
        doc.metadata.chunkIndex !== undefined
          ? `${doc.metadata.sourceId}-${doc.metadata.chunkIndex}`
          : `doc-${index}`,
        doc,
      ])
    ).values()
  );

  return uniqueDocs;
}