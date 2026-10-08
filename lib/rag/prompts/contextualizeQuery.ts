import { OpenAI } from "openai";
import type { ChatMessage } from "../../chat/types.ts";
import { RewrittenQuerySchema } from "../schemas";

const client = new OpenAI({
  baseURL: `https://aicredits.in/v1`,
  apiKey: process.env.OPENAI_API_KEY,
});

export async function contextualizeQuery(
  userQuery: string,
  chatHistory: ChatMessage[] = [],
): Promise<string> {
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
    model: "gpt-5-nano",
    input: [
      {
        role: "developer",
        content: `Given the user and assistant conversation, rewrite the user's current question concisely using the conversation so that it can be answered
        as a standalone question without needing previous messages. Basically answer what does the user's current question actually mean, given the entire conversation?
        
        - Use the conversation to only resolve refrences and missing context.
        - Preserve the user's actual intent.
        - Do not answer the question.
        - Only return the rewritten question as JSON.

        OUTPUT_FORMAT:
        {
        "output": "...."
        }
        `,
      },
      ...messages,
    ],
  });

  let parsedQuery: unknown;

  try {
    parsedQuery = JSON.parse(response.output_text);
  } catch (error) {
    throw new Error("Rewriter returned invalid JSON");
  }

  const validatedRewrite = RewrittenQuerySchema.parse(parsedQuery);

  return validatedRewrite.output;
}
