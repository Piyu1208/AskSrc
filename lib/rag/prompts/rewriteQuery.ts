import OpenAI from "openai";
import { REWRITER_PROMPT } from "./prompts";
import { RewrittenQuerySchema } from '../schemas';


const client = new OpenAI({
    baseURL: `https://aicredits.in/v1`,
    apiKey: process.env.OPENAI_API_KEY,
});


export async function rewriteQuery(
    userQuery: string, 
    missingInfo: string
): Promise<string> {
    const rewriteResponse = await client.responses.create({
        model: "gpt-5-nano",
        instructions: REWRITER_PROMPT,
        input: `User Query: ${userQuery},
        Information to include: ${missingInfo}`,
    });

    let parsedRewrite: unknown;

    try {
        parsedRewrite = JSON.parse(rewriteResponse.output_text);
    } catch (error) {
        throw new Error("Rewriter returned invalid JSON");
    }

    const validatedRewrite = RewrittenQuerySchema.parse(parsedRewrite);
    
    return validatedRewrite.output;
}