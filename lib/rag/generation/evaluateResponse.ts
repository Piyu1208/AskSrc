import OpenAI from "openai";
import { JUDGE_SYS_PROMPT } from "../prompts/prompts";
import { JudgeFeedbackSchema, FinalAnswerSchema } from "../schemas";
import type { RAGDocument } from "../retrieval/vectorSearch";
import type { z } from "zod";

const client = new OpenAI({
  baseURL: "https://aicredits.in/v1",
  apiKey: process.env.OPENAI_API_KEY,
});

type FinalAnswer = z.infer<typeof FinalAnswerSchema>;

// Format retrieved documents for the judge
function formatDocument(doc: RAGDocument) {
  const { metadata } = doc;

  if (metadata.sourceType === "youtube") {
    return {
      sourceType: "youtube",
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
    content: doc.pageContent,
    sourceName: metadata.sourceName,
    pageNumber: metadata.pageNumber,
  };
}

// Retrieved documents + user query + generated answer
// ==> Judge feedback

export async function evaluateResponse(
  rerankedDocuments: RAGDocument[],
  userQuery: string,
  response: FinalAnswer,
) {
  const documents = rerankedDocuments
    .map(formatDocument)
    .map((doc) => JSON.stringify(doc))
    .join("\n\n");

  const judgeResponse = await client.responses.create({
    model: "gpt-4o-mini",
    instructions: JUDGE_SYS_PROMPT,
    input: `Retrieved Documents:
${documents}

User Query:
${userQuery}

Answer:
${JSON.stringify(response, null, 2)}`,
  });

  let parsedFeedback: unknown;

  try {
    parsedFeedback = JSON.parse(judgeResponse.output_text);
  } catch {
    throw new Error("Judge returned invalid JSON");
  }

  return JudgeFeedbackSchema.parse(parsedFeedback);
}
