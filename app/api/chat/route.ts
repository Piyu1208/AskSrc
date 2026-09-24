import { NextRequest, NextResponse } from "next/server";

import OpenAI from "openai";

import { qdrant, COLLECTION_NAME } from "@/lib/qdrant";

import { embedTexts } from "@/lib/embeddings";

export const runtime = "nodejs";

const openai = new OpenAI({
  baseURL: "https://aicredits.in/v1",
  apiKey: process.env.OPENAI_API_KEY,
});

// POST /api/chat
//
// Body:
// {
//   message: string,
//   sourceId?: string,
//   history?: {
//     role: "user" | "assistant";
//     content: string;
//   }[]
// }

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);

    const message = body?.message;

    const sourceId = body?.sourceId as string | undefined;

    const history = body?.history as
      | {
          role: "user" | "assistant";
          content: string;
        }[]
      | undefined;

    // --------------------------------------------------
    // Validate request
    // --------------------------------------------------

    if (!message || typeof message !== "string" || !message.trim()) {
      return NextResponse.json(
        {
          error: "A 'message' string is required.",
        },
        { status: 400 },
      );
    }

    const query = message.trim();

    // --------------------------------------------------
    // 1. Embed user query
    // --------------------------------------------------

    const [queryVector] = await embedTexts([query]);

    if (!queryVector) {
      throw new Error("Failed to create query embedding.");
    }

    // --------------------------------------------------
    // 2. Search Qdrant
    // --------------------------------------------------

    const searchResult = await qdrant.query(COLLECTION_NAME, {
      query: queryVector,
      limit: 5,
      with_payload: true,

      ...(sourceId
        ? {
            filter: {
              must: [
                {
                  key: "sourceId",
                  match: {
                    value: sourceId,
                  },
                },
              ],
            },
          }
        : {}),
    });

    // --------------------------------------------------
    // 3. Build context
    // --------------------------------------------------

    const context = searchResult.points
      .map((point, index) => {
        const payload = point.payload as {
          sourceId?: string;
          sourceType?: string;
          sourceName?: string;
          sourceUrl?: string;
          text?: string;
          pageNumber?: number;
          startTime?: number;
          endTime?: number;
          timestampUrl?: string;
        };

        return `
[Context ${index + 1}]
Source: ${payload.sourceName ?? "Unknown"}
Type: ${payload.sourceType ?? "Unknown"}
${payload.pageNumber !== undefined ? `Page: ${payload.pageNumber}` : ""}
${payload.startTime !== undefined ? `Start time: ${payload.startTime}s` : ""}
${payload.endTime !== undefined ? `End time: ${payload.endTime}s` : ""}

${payload.text ?? ""}
`;
      })
      .join("\n");

    // --------------------------------------------------
    // 4. Include recent conversation history
    // --------------------------------------------------

    const conversationHistory = history?.slice(-10) ?? [];

    // --------------------------------------------------
    // 5. Ask LLM
    // --------------------------------------------------

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",

      messages: [
        {
          role: "system",
          content: `
You are a helpful assistant answering questions
about the user's provided sources.

Use the retrieved context to answer the user's question.

Rules:
- Answer using the provided context.
- Do not invent information that is not supported by the context.
- If the context does not contain enough information,
  clearly say that you don't have enough information.
- Keep the answer concise and directly answer the question.

Retrieved context:

${context || "No relevant context was found."}
`,
        },

        ...conversationHistory,

        {
          role: "user",
          content: query,
        },
      ],
    });

    const answer = response.choices[0]?.message?.content?.trim();

    if (!answer) {
      throw new Error("LLM returned an empty response.");
    }

    // --------------------------------------------------
    // 6. Return answer + sources
    // --------------------------------------------------

    return NextResponse.json({
      answer,

      sources: searchResult.points.map((point) => {
        const payload = point.payload as {
          sourceId?: string;
          sourceType?: string;
          sourceName?: string;
          sourceUrl?: string;
          pageNumber?: number;
          startTime?: number;
          endTime?: number;
          timestampUrl?: string;
        };

        return {
          sourceId: payload.sourceId,
          sourceType: payload.sourceType,
          sourceName: payload.sourceName,
          sourceUrl: payload.sourceUrl,
          pageNumber: payload.pageNumber,
          startTime: payload.startTime,
          endTime: payload.endTime,
          timestampUrl: payload.timestampUrl,
          score: point.score,
        };
      }),
    });
  } catch (err: any) {
    console.error("Chat route error:", err);

    return NextResponse.json(
      {
        error: err?.message || "Failed to process chat request.",
      },
      { status: 500 },
    );
  }
}
