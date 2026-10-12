import OpenAI from "openai";
import { REWRITER_PROMPT } from "./prompts";
import { RewrittenQuerySchema } from '../schemas';
import { log } from "@/lib/observability/logger";
import type { OnTokenUsage } from "@/lib/observability/tokenUsage";


const client = new OpenAI({
    baseURL: `https://aicredits.in/v1`,
    apiKey: process.env.OPENAI_API_KEY,
});


export async function rewriteQuery(
    userQuery: string,
    missingInfo: string,
    requestId: string,
    onTokenUsage?: OnTokenUsage,
): Promise<string> {
    const rewriteResponse = await client.responses.create({
        model: "gpt-5-nano",
        instructions: REWRITER_PROMPT,
        input: `User Query: ${userQuery},
        Information to include: ${missingInfo}`,
    });

    log("info", "llm.usage", {
        requestId,
        stage: "query_rewriting",
        model: "gpt-5-nano",
        inputTokens: rewriteResponse.usage?.input_tokens ?? null,
        outputTokens: rewriteResponse.usage?.output_tokens ?? null,
        totalTokens: rewriteResponse.usage?.total_tokens ?? null,
    });

    const usage = rewriteResponse.usage;

    if (usage) {
        onTokenUsage?.(
            "query_rewriting",
            usage.input_tokens,
            usage.output_tokens,
            usage.total_tokens,
        );
    }

    let parsedRewrite: unknown;

    try {
        parsedRewrite = JSON.parse(rewriteResponse.output_text);
    } catch (error) {
        throw new Error("Rewriter returned invalid JSON");
    }

    const validatedRewrite = RewrittenQuerySchema.parse(parsedRewrite);

    return validatedRewrite.output;
}