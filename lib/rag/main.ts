import { generateAllQueryTransforms } from "./prompts/queryTranslation";
import { rewriteQuery } from "./prompts/rewriteQuery";

import { UserQuerySchema } from "./schemas";
import { vectorSearch } from "./retrieval/vectorSearch";
import { rerankDocs } from "./retrieval/rerank";
import { generateAnswer } from "./generation/generateResponse";
import { evaluateResponse } from "./generation/evaluateResponse";
import { contextualizeQuery } from "./prompts/contextualizeQuery";

import type { RAGDocument } from "./retrieval/vectorSearch";
import type { ChatMessage } from "../chat/types.ts";

const MAX_RETRIES = 1;

export async function main(
    userQuery: string,
    userId: string,
    sourceIds: string[],
    chatHistory: ChatMessage[] = [],
): Promise<Awaited<ReturnType<typeof generateAnswer>>> {
    // ---------------------------------------------------------------------------
    // 1. Query validation
    // ---------------------------------------------------------------------------

    const validation = UserQuerySchema.safeParse({
        query: userQuery,
    });

    if (!validation.success) {
        throw new Error(
            `Invalid user query: ${validation.error.message}`
        );
    }

    const validatedQuery = validation.data.query;

    // ---------------------------------------------------------------------------
    // Contextualize current question
    // ---------------------------------------------------------------------------
    let contextAwareQuery = validatedQuery;
    if (chatHistory.length > 4) {
        contextAwareQuery = await contextualizeQuery(
            validatedQuery,
            chatHistory,
        );

        console.log(`Contexualized Query: ${contextAwareQuery}`);
    }

    // ---------------------------------------------------------------------------
    // 2. RAG loop state
    // ---------------------------------------------------------------------------

    let feedback: Awaited<ReturnType<typeof evaluateResponse>> | undefined;

    let response: Awaited<ReturnType<typeof generateAnswer>>;

    let failureType:
        | "retrieval"
        | "generation"
        | undefined;

    let rerankedDocuments: RAGDocument[] = [];

    let feedbackQuery: string | undefined;

    // ---------------------------------------------------------------------------
    // 3. RAG retry loop
    // ---------------------------------------------------------------------------

    for (let i = 0; i <= MAX_RETRIES; i++) {
        console.log(`Loop number: ${i + 1}`);

        // -------------------------------------------------------------------------
        // Retrieval
        // -------------------------------------------------------------------------

        if (i === 0 || failureType === "retrieval") {
            if (i > 0) {
                if (!feedback) {
                    throw new Error("Feedback is missing before retry.");
                }

                const missingInfo =
                    feedback.missing_information?.join(", ") ?? "";

                feedbackQuery = await rewriteQuery(
                    contextAwareQuery,
                    missingInfo
                );
            }

            // Query translation
            const {
                stepback,
                subquestions,
                rewriting,
                hyde,
            } = await generateAllQueryTransforms(
                feedbackQuery ?? contextAwareQuery
            );

            // Keep all transformed queries
            const rewrittenQueries: string[] = [
                stepback,
                ...subquestions,
                rewriting,
                hyde,
            ].filter(
                (query): query is string => Boolean(query)
            );

            // Vector search with user + source isolation
            const retrievedDocs = await vectorSearch(
                rewrittenQueries,
                userId,
                sourceIds
            );

            // Rerank documents
            rerankedDocuments = await rerankDocs(
                retrievedDocs,
                9,
                validatedQuery,
                feedbackQuery
            );
        }

        // -------------------------------------------------------------------------
        // Generation retry
        // -------------------------------------------------------------------------

        let generationQuery = validatedQuery;

        if (failureType === "generation") {
            if (!feedback) {
                throw new Error("Feedback is missing before retry.");
            }

            const generationFeedback =
                feedback.generation_feedback?.join(", ") ?? "";

            generationQuery =
                `${validatedQuery}, ${generationFeedback}`;

            console.log('Query with generation feedback: ', generationQuery);
        }

        // -------------------------------------------------------------------------
        // Generate answer
        // -------------------------------------------------------------------------

        console.log("Generating response...");

        response = await generateAnswer(
            rerankedDocuments,
            generationQuery,
            chatHistory,
        );

        // -------------------------------------------------------------------------
        // Judge answer
        // -------------------------------------------------------------------------

        feedback = await evaluateResponse(
            rerankedDocuments,
            generationQuery,
            response
        );

        console.log("Feedback:", feedback);

        // -------------------------------------------------------------------------
        // Decide whether to retry
        // -------------------------------------------------------------------------

        if (!feedback.retry || i === MAX_RETRIES) {
            console.log("Success.");
            return response;
        }

        // failure_type can be null according to the schema
        failureType =
            feedback.failure_type ?? undefined;
    }

    throw new Error("RAG pipeline failed unexpectedly.");
}