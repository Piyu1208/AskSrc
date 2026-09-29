import { CohereRerank } from "@langchain/cohere";
import type { RAGDocument } from "./vectorSearch";

const cohereConfig = {
  apiKey: process.env.COHERE_API_KEY,
  model: "rerank-v4.0-pro",
};

export async function rerankDocs(
  uniqueDocs: RAGDocument[],
  topN: number,
  userQuery: string,
  feedbackQuery: string | null = null
): Promise<RAGDocument[]> {
  const cohereRerank = new CohereRerank({
    ...cohereConfig,
    topN,
  });

  const reranked = await cohereRerank.compressDocuments(
    uniqueDocs,
    feedbackQuery || userQuery
  );

  return reranked as RAGDocument[];
}