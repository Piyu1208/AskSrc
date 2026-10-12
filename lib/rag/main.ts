
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

import type {
    TokenUsageSummary,
    OnTokenUsage,
} from "@/lib/observability/tokenUsage";

import {
    recordTokenUsage,
    measureStage,
} from "@/lib/observability/tokenUsage";

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

    let pipelineStatus: "success" | "error" = "error";
    let attempts = 0;

    try {
        log("info", "rag.started", { requestId });

        // 1. Validate the query
        const validation = UserQuerySchema.safeParse({
            query: userQuery,
        });

        if (!validation.success) {
            throw new Error(
                `Invalid user query: ${validation.error.message}`,
            );
        }

        const validatedQuery = validation.data.query;

        // 2. Contextualize the current question
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

            console.log(
                `Contextualized Query: ${contextAwareQuery}`,
            );
        }

        // 3. RAG loop state
        let feedback:
            | Awaited<ReturnType<typeof evaluateResponse>>
            | undefined;

        let response:
            Awaited<ReturnType<typeof generateAnswer>>;

        let failureType: "retrieval" | "generation" | undefined;

        let rerankedDocuments: RAGDocument[] = [];
        let feedbackQuery: string | undefined;

        // Last retrieval metrics, retained for generation-only retries
        let queryCount = 0;
        let retrievedCount = 0;

        // 4. RAG retry loop
        for (let i = 0; i <= MAX_RETRIES; i++) {
            attempts = i + 1;

            console.log(`Loop number: ${attempts}`);

            // Retrieval
            if (i === 0 || failureType === "retrieval") {
                if (i > 0) {
                    if (!feedback) {
                        throw new Error(
                            "Feedback is missing before retry.",
                        );
                    }

                    const missingInfo =
                        feedback.missing_information?.join(", ") ?? "";

                    feedbackQuery = await measureStage(
                        requestId,
                        "rag.query_rewriting.completed",
                        { attempt: attempts },
                        () => rewriteQuery(
                            contextAwareQuery,
                            missingInfo,
                            requestId,
                            onTokenUsage,
                        ),
                    );
                }

                // Query transformation
                const {
                    stepback,
                    subquestions,
                    rewriting,
                    hyde,
                } = await measureStage(
                    requestId,
                    "rag.query_transformation.completed",
                    { attempt: attempts },
                    () => generateAllQueryTransforms(
                        feedbackQuery ?? contextAwareQuery,
                        requestId,
                        onTokenUsage,
                    ),
                );

                const rewrittenQueries: string[] = [
                    stepback,
                    ...subquestions,
                    rewriting,
                    hyde,
                ].filter(
                    (query): query is string => Boolean(query),
                );

                queryCount = rewrittenQueries.length;

                // Vector search with user/source isolation
                const retrievedDocs = await measureStage(
                    requestId,
                    "rag.retrieval.completed",
                    {
                        attempt: attempts,
                        queryCount,
                    },
                    () => vectorSearch(
                        rewrittenQueries,
                        userId,
                        sourceIds,
                    ),
                );

                retrievedCount = retrievedDocs.length;

                log("info", "rag.retrieval.results", {
                    requestId,
                    attempt: attempts,
                    queryCount,
                    retrievedCount,
                });

                // Rerank documents
                rerankedDocuments = await measureStage(
                    requestId,
                    "rag.reranking.completed",
                    {
                        attempt: attempts,
                        inputCount: retrievedCount,
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
                    attempt: attempts,
                    rerankedCount: rerankedDocuments.length,
                });
            }

            // Generation retry feedback
            let generationQuery = validatedQuery;

            if (failureType === "generation") {
                if (!feedback) {
                    throw new Error(
                        "Feedback is missing before retry.",
                    );
                }

                const generationFeedback =
                    feedback.generation_feedback?.join(", ") ?? "";

                generationQuery =
                    `${validatedQuery}, ${generationFeedback}`;

                console.log(
                    "Query with generation feedback:",
                    generationQuery,
                );
            }

            // Generate answer
            console.log("Generating response...");

            response = await measureStage(
                requestId,
                "rag.generation.completed",
                { attempt: attempts },
                () => generateAnswer(
                    rerankedDocuments,
                    generationQuery,
                    chatHistory,
                    requestId,
                    onTokenUsage,
                ),
            );

            // Evaluate answer
            feedback = await measureStage(
                requestId,
                "rag.evaluation.completed",
                { attempt: attempts },
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
                attempt: attempts,
                retry: feedback.retry,
                failureType: feedback.failure_type,
            });

            // Consolidated metrics for this attempt
            log("info", "rag.attempt.metrics", {
                requestId,
                attempt: attempts,
                queryCount,
                retrievedCount,
                rerankedCount: rerankedDocuments.length,
                retryRequested: feedback.retry,
                failureType: feedback.failure_type,
            });

            // Stop or retry
            if (!feedback.retry || i === MAX_RETRIES) {
                log("info", "rag.completed", {
                    requestId,
                    status: "success",
                    attempts,
                    retryCount: attempts - 1,
                    totalLatencyMs: Math.round(
                        performance.now() - pipelineStartedAt,
                    ),
                });

                pipelineStatus = "success";
                return response;
            }

            log("warn", "rag.retry", {
                requestId,
                fromAttempt: attempts,
                toAttempt: attempts + 1,
                retryReason: feedback.failure_type,
            });

            // failure_type may be null according to the schema
            failureType = feedback.failure_type ?? undefined;
        }

        throw new Error("RAG pipeline failed unexpectedly.");
    } catch (error) {
        log("error", "rag.failed", {
            requestId,
            attempts,
            errorName:
                error instanceof Error
                    ? error.name
                    : "UnknownError",
            totalLatencyMs: Math.round(
                performance.now() - pipelineStartedAt,
            ),
        });

        throw error;
    } finally {
        log(
            pipelineStatus === "success" ? "info" : "error",
            "llm.usage.summary",
            {
                requestId,
                status: pipelineStatus,
                attempts,
                totalLatencyMs: Math.round(
                    performance.now() - pipelineStartedAt,
                ),
                ...tokenUsage,
            },
        );
    }
}
