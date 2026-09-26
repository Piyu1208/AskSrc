import { getDb } from "@/lib/db";
import { randomUUID } from "crypto";

export type Source = {
    id: string;
    userId: string;
    name: string;
    type: "youtube" | "pdf";
    chunks: number;
    createdAt: Date;
};

export async function createSource(
    userId: string,
    name: string,
    type: Source["type"],
    chunks: number,
) {
    const db = await getDb();

    const source: Source = {
        id: randomUUID(),
        userId,
        name,
        type,
        chunks,
        createdAt: new Date(),
    };

    await db.collection<Source>("sources").insertOne(source);

    return source;
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