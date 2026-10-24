import { getDb } from "@/lib/db";
import { randomUUID } from "crypto";

export type SourceStatus = "processing" | "completed" | "failed" | "deleting";

export type Source = {
    id: string;
    userId: string;
    name: string;
    type: "youtube" | "pdf";
    chunks: number;
    status: SourceStatus;
    createdAt: Date;
};

export async function createSource(
    userId: string,
    name: string,
    type: Source["type"],
    chunks: number,
    status: SourceStatus = "processing",
) {
    const db = await getDb();

    const source: Source = {
        id: randomUUID(),
        userId,
        name,
        type,
        chunks,
        status,
        createdAt: new Date(),
    };

    await db.collection<Source>("sources").insertOne(source);

    return source;
}

export async function updateSourceStatus(
    sourceId: string,
    userId: string,
    status: SourceStatus,
) {
    const db = await getDb();

    await db.collection<Source>("sources").updateOne(
        { id: sourceId, userId },
        { $set: { status } },
    );
}

export async function getSourcesByUser(userId: string) {
    const db = await getDb();

    return db
        .collection<Source>("sources")
        .find(
            { userId },
            {
                projection: {
                    _id: 0,
                    userId: 0,
                },
            }
        )
        .sort({ createdAt: -1 })
        .toArray();
}