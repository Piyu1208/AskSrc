import OpenAI from "openai";
import { z } from "zod";
import { TRANSLATOR_SYSTEM_PROMPT, HYDE_SYS_PROMPT } from "./prompts";
import { QueryTransformsSchema, QueryTransforms, TranslatorResponseSchema, HydeResponseSchema } from '../schemas';
import { log } from "@/lib/observability/logger";

const client = new OpenAI({
  baseURL: `https://aicredits.in/v1`,
  apiKey: process.env.OPENAI_API_KEY,
});


async function generateQueryTransform<T>(
  query: string,
  instructions: string,
  schema: z.ZodType<T>,
  requestId: string,
  stage: string,
): Promise<T> {
  const response = await client.responses.create({
    model: "gpt-4o-mini",
    instructions,
    input: query,
  });

  log("info", "llm.usage", {
    requestId,
    stage,
    model: "gpt-4o-mini",
    inputTokens: response.usage?.input_tokens ?? null,
    outputTokens: response.usage?.output_tokens ?? null,
    totalTokens: response.usage?.total_tokens ?? null,
  });

  const parsed = JSON.parse(response.output_text);

  return schema.parse(parsed);
}




export async function generateAllQueryTransforms(
  query: string,
  requestId: string,
): Promise<QueryTransforms> {
  const [translator, hyde] = await Promise.all([
    generateQueryTransform(
      query,
      TRANSLATOR_SYSTEM_PROMPT,
      TranslatorResponseSchema,
      requestId,
      "query_translation",
    ),

    generateQueryTransform(
      query,
      HYDE_SYS_PROMPT,
      HydeResponseSchema,
      requestId,
      "hyde",
    ),
  ]);

  const result = {
    stepback: translator.stepback,
    subquestions: translator.subquestions,
    rewriting: translator.rewriting,
    hyde: hyde.output,
  };

  return QueryTransformsSchema.parse(result);
}