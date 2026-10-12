import { log } from "@/lib/observability/logger";

export async function measureStage<T>(
    requestId: string,
    event: string,
    data: Record<string, unknown>,
    operation: () => Promise<T>,
): Promise<T> {
    const startedAt = performance.now();

    try {
        const result = await operation();

        log("info", event, {
            requestId,
            ...data,
            latencyMs: Math.round(performance.now() - startedAt),
        });

        return result;
    } catch (error) {
        log("error", `${event}.failed`, {
            requestId,
            ...data,
            latencyMs: Math.round(performance.now() - startedAt),
            errorName:
                error instanceof Error ? error.name : "UnknownError",
        });

        throw error;
    }
}

export type StageUsage = {
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
    calls: number;
};

export type TokenUsageSummary = {
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
    calls: number;
    byStage: Record<string, StageUsage>;
};

export type OnTokenUsage = (
    stage: string,
    inputTokens: number,
    outputTokens: number,
    totalTokens: number,
) => void;


export function recordTokenUsage(
    summary: TokenUsageSummary,
    stage: string,
    inputTokens: number,
    outputTokens: number,
    totalTokens: number,
) {
    summary.inputTokens += inputTokens;
    summary.outputTokens += outputTokens;
    summary.totalTokens += totalTokens;
    summary.calls += 1;

    const stageUsage = (summary.byStage[stage] ??= {
        inputTokens: 0,
        outputTokens: 0,
        totalTokens: 0,
        calls: 0,
    });

    stageUsage.inputTokens += inputTokens;
    stageUsage.outputTokens += outputTokens;
    stageUsage.totalTokens += totalTokens;
    stageUsage.calls += 1;
}