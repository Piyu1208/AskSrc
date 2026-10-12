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

import { log } from "@/lib/observability/logger";

import type { StageUsage, TokenUsageSummary, OnTokenUsage } from "@/lib/observability/tokenUsage";
import { recordTokenUsage, measureStage } from "@/lib/observability/tokenUsage";

const MAX_RETRIES = 1;





export async function main(
    userQuery: string,
    userId: string,
    sourceIds: string[],
    chatHistory: ChatMessage[] = [],
    requestId: string,
): Promise<Awaited<ReturnType<typeof generateAnswer>>> {

    const tokenUsage: TokenUsageSummary = {
        inputTokens: 0,
        outputTokens: 0,
        totalTokens: 0,
        calls: 0,
        byStage: {},
    };

    const onTokenUsage: OnTokenUsage = (
        stage,
        inputTokens,
        outputTokens,
        totalTokens,
    ) => {
        recordTokenUsage(
            tokenUsage,
            stage,
            inputTokens,
            outputTokens,
            totalTokens,
        );
    };

    const pipelineStartedAt = performance.now();

    log("info", "rag.started", {
        requestId,
    });
    // ---------------------------------------------------------------------------
    // 1. Query validation
    // ---------------------------------------------------------------------------

    const validation = UserQuerySchema.safeParse({
        query: userQuery,
    });

    if (!validation.success) {
        throw new Error(`Invalid user query: ${validation.error.message}`);
    }

    const validatedQuery = validation.data.query;

    // ---------------------------------------------------------------------------
    // Contextualize current question
    // ---------------------------------------------------------------------------
    let contextAwareQuery = validatedQuery;
    if (chatHistory.length >= 2) {
        contextAwareQuery = await measureStage(
            requestId,
            "rag.contextualization.completed",
            {},
            () => contextualizeQuery(
                validatedQuery,
                chatHistory,
                requestId,
                onTokenUsage,
            ),
        );

        console.log(`Contexualized Query: ${contextAwareQuery}`);
    }

    // ---------------------------------------------------------------------------
    // 2. RAG loop state
    // ---------------------------------------------------------------------------

    let feedback: Awaited<ReturnType<typeof evaluateResponse>> | undefined;

    let response: Awaited<ReturnType<typeof generateAnswer>>;

    let failureType: "retrieval" | "generation" | undefined;

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

                const missingInfo = feedback.missing_information?.join(", ") ?? "";

                feedbackQuery = await measureStage(
                    requestId,
                    "rag.query_rewriting.completed",
                    {},
                    () => rewriteQuery(
                        contextAwareQuery,
                        missingInfo,
                        requestId,
                        onTokenUsage,
                    )
                );
            }

            // Query translation
            const { stepback, subquestions, rewriting, hyde } =
                await measureStage(
                    requestId,
                    "rag.query_transformation.completed",
                    { attempt: i + 1 },
                    () => generateAllQueryTransforms(
                        feedbackQuery ?? contextAwareQuery,
                        requestId,
                        onTokenUsage,
                    ),
                );

            // Keep all transformed queries
            const rewrittenQueries: string[] = [
                stepback,
                ...subquestions,
                rewriting,
                hyde,
            ].filter((query): query is string => Boolean(query));

            // Vector search with user + source isolation
            const retrievedDocs = await measureStage(
                requestId,
                "rag.retrieval.completed",
                {
                    attempt: i + 1,
                    queryCount: rewrittenQueries.length,
                },
                () => vectorSearch(
                    rewrittenQueries,
                    userId,
                    sourceIds,
                ),
            );

            log("info", "rag.retrieval.results", {
                requestId,
                attempt: i + 1,
                retrievedCount: retrievedDocs.length,
            });

            // Rerank documents
            rerankedDocuments = await measureStage(
                requestId,
                "rag.reranking.completed",
                {
                    attempt: i + 1,
                    inputCount: retrievedDocs.length,
                },
                () => rerankDocs(
                    retrievedDocs,
                    9,
                    validatedQuery,
                    feedbackQuery,
                ),
            );

            log("info", "rag.reranking.results", {
                requestId,
                attempt: i + 1,
                rerankedCount: rerankedDocuments.length,
            });
        }

        // -------------------------------------------------------------------------
        // Generation retry
        // -------------------------------------------------------------------------

        let generationQuery = validatedQuery;

        if (failureType === "generation") {
            if (!feedback) {
                throw new Error("Feedback is missing before retry.");
            }

            const generationFeedback = feedback.generation_feedback?.join(", ") ?? "";

            generationQuery = `${validatedQuery}, ${generationFeedback}`;

            console.log("Query with generation feedback: ", generationQuery);
        }

        // -------------------------------------------------------------------------
        // Generate answer
        // -------------------------------------------------------------------------

        console.log("Generating response...");

        response = await measureStage(
            requestId,
            "rag.generation.completed",
            { attempt: i + 1 },
            () => generateAnswer(
                rerankedDocuments,
                generationQuery,
                chatHistory,
                requestId,
                onTokenUsage,
            ),
        );

        // -------------------------------------------------------------------------
        // Judge answer
        // -------------------------------------------------------------------------

        feedback = await measureStage(
            requestId,
            "rag.evaluation.completed",
            { attempt: i + 1 },
            () => evaluateResponse(
                rerankedDocuments,
                generationQuery,
                response,
                requestId,
                onTokenUsage,
            ),
        );

        log("info", "rag.judge.decision", {
            requestId,
            attempt: i + 1,
            retry: feedback.retry,
            failureType: feedback.failure_type,
        });

        // -------------------------------------------------------------------------
        // Decide whether to retry
        // -------------------------------------------------------------------------

        if (!feedback.retry || i === MAX_RETRIES) {

            log("info", "rag.completed", {
                requestId,
                status: "success",
                attempts: i + 1,
                retryCount: i,
                totalLatencyMs: Math.round(
                    performance.now() - pipelineStartedAt
                ),
            });

            log("info", "llm.usage.summary", {
                requestId,
                ...tokenUsage,
            });

            return response;
        }

        // failure_type can be null according to the schema
        failureType = feedback.failure_type ?? undefined;
    }

    throw new Error("RAG pipeline failed unexpectedly.");
}
