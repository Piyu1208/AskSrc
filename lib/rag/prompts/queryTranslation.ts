import OpenAI from "openai";
import { z } from "zod";
import { TRANSLATOR_SYSTEM_PROMPT, HYDE_SYS_PROMPT } from "./prompts";
import { QueryTransformsSchema, QueryTransforms, TranslatorResponseSchema, HydeResponseSchema } from '../schemas';

const client = new OpenAI({
  baseURL: `https://aicredits.in/v1`,
  apiKey: process.env.OPENAI_API_KEY,
});


async function generateQueryTransform<T>(
    query: string, 
    instructions: string,
    schema: z.ZodType<T>
): Promise<T> {
  const response = await client.responses.create({
    model: "gpt-5-nano",
    instructions,
    input: query,
  });

  const parsed = JSON.parse(response.output_text);

  return schema.parse(parsed);
}




export async function generateAllQueryTransforms(
    query: string
): Promise<QueryTransforms> {
  const [translator, hyde] = await Promise.all([
    generateQueryTransform(
      query, 
      TRANSLATOR_SYSTEM_PROMPT,
      TranslatorResponseSchema
    ),

    generateQueryTransform(
      query, 
      HYDE_SYS_PROMPT,
      HydeResponseSchema
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