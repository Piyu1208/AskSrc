import OpenAI from "openai";
import { SYSTEM_PROMPT } from "../prompts/prompts";
import { FinalAnswerSchema } from "../schemas";
import type { RAGDocument } from "../retrieval/vectorSearch";
import type { ChatMessage } from "../../chat/types.ts";
import { log } from "@/lib/observability/logger";
import type { OnTokenUsage } from "@/lib/observability/tokenUsage";

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
  userQuery: string,
  chatHistory: ChatMessage[] = [],
  requestId: string,
  onTokenUsage?: OnTokenUsage,
) {
  const documents = rerankedDocuments
    .map(formatDocument)
    .map((doc) => JSON.stringify(doc))
    .join("\n\n");

  const messages = [
    ...chatHistory
      .filter((message) => !message.isError)
      .map((message) => ({
        role: message.role,
        content: message.content,
      })),
    {
      role: "user" as const,
      content: userQuery,
    },
  ];

  const response = await client.responses.create({
    model: "gpt-4o-mini",
    input: [
      {
        role: "developer",
        content: SYSTEM_PROMPT
      },
      {
        role: "developer",
        content: `User Documents: 
        ${documents}`
      },
      ...messages,
    ],
    text: {
      format: {
        type: "json_schema",
        name: "final_answer",
        strict: true,
        schema: {
          type: "object",
          properties: {
            answer: {
              type: "string",
            },
            sources: {
              type: "array",
              items: {
                anyOf: [
                  {
                    type: "object",
                    properties: {
                      type: {
                        type: "string",
                        enum: ["youtube"],
                      },
                      sourceId: {
                        type: "string",
                      },
                      timestampUrl: {
                        type: "string",
                      },
                    },
                    required: ["type", "sourceId", "timestampUrl"],
                    additionalProperties: false,
                  },
                  {
                    type: "object",
                    properties: {
                      type: {
                        type: "string",
                        enum: ["pdf"],
                      },
                      sourceId: {
                        type: "string",
                      },
                      pageNumber: {
                        type: "number",
                      },
                    },
                    required: ["type", "sourceId", "pageNumber"],
                    additionalProperties: false,
                  },
                ],
              },
            },
          },
          required: ["answer", "sources"],
          additionalProperties: false,
        },
      }
    }
  });

  log("info", "llm.usage", {
    requestId,
    stage: "answer_generation",
    model: "gpt-4o-mini",
    inputTokens: response.usage?.input_tokens ?? null,
    outputTokens: response.usage?.output_tokens ?? null,
    totalTokens: response.usage?.total_tokens ?? null,
  });

  const usage = response.usage;

  if (usage) {
    onTokenUsage?.(
      "answer_generation",
      usage.input_tokens,
      usage.output_tokens,
      usage.total_tokens,
    );
  }

  let parsedAnswer: unknown;

  try {
    parsedAnswer = JSON.parse(response.output_text);
  } catch {
    console.log("RAW LLM OUTPUT:", response.output_text);
    throw new Error("LLM returned invalid JSON.");
  }

  return FinalAnswerSchema.parse(parsedAnswer);
}