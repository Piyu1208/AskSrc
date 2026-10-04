import OpenAI from "openai";
import { SYSTEM_PROMPT } from "../prompts/prompts";
import { FinalAnswerSchema } from "../schemas";
import type { RAGDocument } from "../retrieval/vectorSearch";

const client = new OpenAI({
  baseURL: "https://aicredits.in/v1",
  apiKey: process.env.OPENAI_API_KEY,
});

function formatDocument(doc: RAGDocument) {
  const { metadata } = doc;

  if (metadata.sourceType === "youtube") {
    return {
      sourceType: "youtube",
      sourceId: metadata.sourceId,
      content: doc.pageContent,
      sourceUrl: metadata.sourceUrl,
      videoId: metadata.videoId,
      startTime: metadata.startTime,
      endTime: metadata.endTime,
      timestampUrl: metadata.timestampUrl,
    };
  }

  return {
    sourceType: "pdf",
    sourceId: metadata.sourceId,
    content: doc.pageContent,
    sourceName: metadata.sourceName,
    pageNumber: metadata.pageNumber,
  };
}

export async function generateAnswer(
  rerankedDocuments: RAGDocument[],
  userQuery: string
) {
  const documents = rerankedDocuments
    .map(formatDocument)
    .map((doc) => JSON.stringify(doc))
    .join("\n\n");

  const response = await client.responses.create({
    model: "gpt-4o-mini",
    instructions: SYSTEM_PROMPT,
    input: `User Documents:
${documents}

User Query: ${userQuery}`,
  });

  let parsedAnswer: unknown;

  try {
    parsedAnswer = JSON.parse(response.output_text);
  } catch {
    throw new Error("LLM returned invalid JSON.");
  }

  return FinalAnswerSchema.parse(parsedAnswer);
}