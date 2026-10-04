import { z } from "zod";



export const UserQuerySchema = z.object({
  query: z
    .string()
    .trim()
    .min(1, "Query cannot be empty")
    .max(1000, "Query is too long"),
});



export const TranslatorResponseSchema = z.object({
  stepback: z.string(),
  subquestions: z.array(z.string()),
  rewriting: z.string(),
});

export const HydeResponseSchema = z.object({
  output: z.string(),
});

export const QueryTransformsSchema = z.object({
  stepback: z.string(),
  subquestions: z.array(z.string()).length(3),
  rewriting: z.string(),
  hyde: z.string(),
});

export type QueryTransforms = z.infer<typeof QueryTransformsSchema>;


export const RewrittenQuerySchema = z.object({
  output: z
    .string()
    .trim()
    .min(1)
    .max(1200),
});


export const JudgeFeedbackSchema = z.object({
  retry: z.boolean(),

  failure_type: z.enum([
    "retrieval",
    "generation",
  ]).nullable(),

  missing_information: z.array(z.string()).nullable(),

  generation_feedback: z.array(z.string()).nullable(),
});


const YoutubeSourceSchema = z.object({
  type: z.literal("youtube"),
  sourceId: z.string(),
  timestampUrl: z.string(),
});

const PDFSourceSchema = z.object({
  type: z.literal("pdf"),
  sourceId: z.string(),
  pageNumber: z.number(),
});


export const FinalAnswerSchema = z.object({
  answer: z.string(),
  sources: z.array(
    z.discriminatedUnion("type", [
      YoutubeSourceSchema,
      PDFSourceSchema,
    ])
  ),
});

