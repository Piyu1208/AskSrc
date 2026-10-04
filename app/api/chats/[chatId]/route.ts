import { NextRequest, NextResponse } from "next/server";
import { ObjectId } from "mongodb";

import { getDb } from "@/lib/db";
import { getSession } from "@/lib/get-session";
import type { Chat } from "@/lib/models/chat";
import type { Message } from "@/lib/models/message";

export const runtime = "nodejs";

type RouteContext = {
    params: Promise<{
        chatId: string;
    }>;
};

// GET /api/chats/[chatId]
export async function GET(
    _req: NextRequest,
    { params }: RouteContext
) {
    try {
        const session = await getSession();

        if (!session?.user?.id) {
            return NextResponse.json(
                { error: "Unauthorized" },
                { status: 401 }
            );
        }

        const { chatId } = await params;

        if (!ObjectId.isValid(chatId)) {
            return NextResponse.json(
                { error: "Invalid chat ID" },
                { status: 400 }
            );
        }

        const db = await getDb();

        const chat = await db
            .collection<Chat>("chats")
            .findOne({
                _id: new ObjectId(chatId),
                userId: session.user.id,
            });

        if (!chat) {
            return NextResponse.json(
                { error: "Chat not found" },
                { status: 404 }
            );
        }

        const messages = await db
            .collection<Message>("messages")
            .find({
                chatId: chat._id,
                userId: session.user.id,
            })
            .sort({ createdAt: 1 })
            .toArray();

        return NextResponse.json({
            chat,
            messages,
        });
    } catch (error) {
        console.error("Get chat error:", error);

        return NextResponse.json(
            { error: "Failed to fetch chat" },
            { status: 500 }
        );
    }
}

// PATCH /api/chats/[chatId]
export async function PATCH(
    req: NextRequest,
    { params }: RouteContext
) {
    try {
        const session = await getSession();

        if (!session?.user?.id) {
            return NextResponse.json(
                { error: "Unauthorized" },
                { status: 401 }
            );
        }

        const { chatId } = await params;

        if (!ObjectId.isValid(chatId)) {
            return NextResponse.json(
                { error: "Invalid chat ID" },
                { status: 400 }
            );
        }

        const body = await req.json();

        const update: Partial<Pick<Chat, "title" | "sourceIds">> = {};

        if (typeof body.title === "string") {
            const title = body.title.trim();

            if (!title) {
                return NextResponse.json(
                    { error: "Title cannot be empty" },
                    { status: 400 }
                );
            }

            update.title = title.slice(0, 100);
        }

        const db = await getDb();

        if (Array.isArray(body.sourceIds)) {
            if (!body.sourceIds.every((id: unknown) => typeof id === "string")) {
                return NextResponse.json(
                    { error: "Invalid source IDs" },
                    { status: 400 }
                );
            }

            const sourceIds = [...new Set(body.sourceIds as string[])];

            const sources = await db
                .collection("sources")
                .find({
                    id: { $in: sourceIds },
                    userId: session.user.id,
                })
                .toArray();

            if (sources.length !== sourceIds.length) {
                return NextResponse.json(
                    { error: "One or more sources are invalid" },
                    { status: 403 }
                );
            }

            update.sourceIds = sourceIds;
        }

        if (Object.keys(update).length === 0) {
            return NextResponse.json(
                { error: "Nothing to update" },
                { status: 400 }
            );
        }



        const result = await db.collection<Chat>("chats").findOneAndUpdate(
            {
                _id: new ObjectId(chatId),
                userId: session.user.id,
            },
            {
                $set: {
                    ...update,
                    updatedAt: new Date(),
                },
            },
            {
                returnDocument: "after",
            }
        );

        if (!result) {
            return NextResponse.json(
                { error: "Chat not found" },
                { status: 404 }
            );
        }

        return NextResponse.json({ chat: result });
    } catch (error) {
        console.error("Update chat error:", error);

        return NextResponse.json(
            { error: "Failed to update chat" },
            { status: 500 }
        );
    }
}

// DELETE /api/chats/[chatId]
export async function DELETE(
    _req: NextRequest,
    { params }: RouteContext
) {
    try {
        const session = await getSession();

        if (!session?.user?.id) {
            return NextResponse.json(
                { error: "Unauthorized" },
                { status: 401 }
            );
        }

        const { chatId } = await params;

        if (!ObjectId.isValid(chatId)) {
            return NextResponse.json(
                { error: "Invalid chat ID" },
                { status: 400 }
            );
        }

        const db = await getDb();

        const chatResult = await db.collection<Chat>("chats").deleteOne({
            _id: new ObjectId(chatId),
            userId: session.user.id,
        });

        if (chatResult.deletedCount === 0) {
            return NextResponse.json(
                { error: "Chat not found" },
                { status: 404 }
            );
        }

        await db.collection<Message>("messages").deleteMany({
            chatId: new ObjectId(chatId),
            userId: session.user.id,
        });

        return NextResponse.json({
            success: true,
        });
    } catch (error) {
        console.error("Delete chat error:", error);

        return NextResponse.json(
            { error: "Failed to delete chat" },
            { status: 500 }
        );
    }
}