
import { NextRequest, NextResponse } from "next/server";
import { ObjectId } from "mongodb";

import { getDb } from "@/lib/db";
import { getSession } from "@/lib/get-session";
import type { Chat } from "@/lib/models/chat";

export const runtime = "nodejs";

// Create a new chat
export async function POST(req: NextRequest) {
  try {
    const session = await getSession();

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const body = await req.json().catch(() => ({}));

    const title =
      typeof body.title === "string" && body.title.trim()
        ? body.title.trim().slice(0, 100)
        : "New Chat";

    const db = await getDb();
    const chats = db.collection<Chat>("chats");

    const now = new Date();

    const chat: Chat = {
      _id: new ObjectId(),
      userId: session.user.id,
      title,
      sourceIds: [],
      createdAt: now,
      updatedAt: now,
      lastMessageAt: null,
    };

    await chats.insertOne(chat);

    return NextResponse.json({ chat }, { status: 201 });
  } catch (error) {
    console.error("Create chat error:", error);

    return NextResponse.json(
      { error: "Failed to create chat" },
      { status: 500 }
    );
  }
}

// Fetch user's chats
export async function GET() {
  try {
    const session = await getSession();

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const db = await getDb();
    const chats = db.collection<Chat>("chats");

    const userChats = await chats
      .find({ userId: session.user.id })
      .sort({ updatedAt: -1 })
      .toArray();

    return NextResponse.json({ chats: userChats });
  } catch (error) {
    console.error("Fetch chats error:", error);

    return NextResponse.json(
      { error: "Failed to fetch chats" },
      { status: 500 }
    );
  }
}