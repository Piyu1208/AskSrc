import { NextRequest, NextResponse } from "next/server";
import { ObjectId } from "mongodb";

import { getDb } from "@/lib/db";
import { getSession } from "@/lib/get-session";
import type { Chat } from "@/lib/models/chat";
import type { Message } from "@/lib/models/message";
import { main } from "@/lib/rag/main";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{
    chatId: string;
  }>;
};


// GET /api/chats/[chatId]/messages
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

    // Verify chat ownership
    const chat = await db.collection<Chat>("chats").findOne({
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

    return NextResponse.json({ messages });
  } catch (error) {
    console.error("Get messages error:", error);

    return NextResponse.json(
      { error: "Failed to fetch messages" },
      { status: 500 }
    );
  }
}


// POST /api/chats/[chatId]/messages
export async function POST(
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

    if (
      typeof body.content !== "string" ||
      !body.content.trim()
    ) {
      return NextResponse.json(
        { error: "Message content is required" },
        { status: 400 }
      );
    }

    const content = body.content.trim();

    const db = await getDb();

    // --------------------------------------------------------------------------
    // 1. Verify chat ownership
    // --------------------------------------------------------------------------

    const chat = await db.collection<Chat>("chats").findOne({
      _id: new ObjectId(chatId),
      userId: session.user.id,
    });

    if (!chat) {
      return NextResponse.json(
        { error: "Chat not found" },
        { status: 404 }
      );
    }

    // --------------------------------------------------------------------------
    // 2. Make sure the chat has sources
    // --------------------------------------------------------------------------

    if (chat.sourceIds.length === 0) {
      return NextResponse.json(
        { error: "No sources are attached to this chat" },
        { status: 400 }
      );
    }

    // --------------------------------------------------------------------------
    // 3. Load previous conversation
    // --------------------------------------------------------------------------

    const previousMessages = await db
      .collection<Message>("messages")
      .find({
        chatId: chat._id,
        userId: session.user.id,
      })
      .sort({ createdAt: 1 })
      .toArray();

    // Convert Mongo messages to the ChatMessage shape expected by main()
    const chatHistory = previousMessages.map((message) => ({
      id: message._id.toString(),
      role: message.role,
      content: message.content,
      sources: message.sources,
      createdAt: message.createdAt.toISOString(),
    }));

    // --------------------------------------------------------------------------
    // 4. Run RAG pipeline
    // --------------------------------------------------------------------------

    const response = await main(
      content,
      session.user.id,
      chat.sourceIds,
      chatHistory
    );

    // --------------------------------------------------------------------------
    // 5. Save user message
    // --------------------------------------------------------------------------

    const now = new Date();

    const userMessage: Message = {
      _id: new ObjectId(),
      chatId: chat._id,
      userId: session.user.id,
      role: "user",
      content,
      sources: [],
      createdAt: now,
    };

    await db
      .collection<Message>("messages")
      .insertOne(userMessage);

    // --------------------------------------------------------------------------
    // 6. Save assistant message
    // --------------------------------------------------------------------------

    const assistantMessage: Message = {
      _id: new ObjectId(),
      chatId: chat._id,
      userId: session.user.id,
      role: "assistant",
      content: response.answer,
      sources: response.sources,
      createdAt: new Date(),
    };

    await db
      .collection<Message>("messages")
      .insertOne(assistantMessage);

    // --------------------------------------------------------------------------
    // 7. Update chat activity
    // --------------------------------------------------------------------------

    const updatedAt = new Date();

    await db.collection<Chat>("chats").updateOne(
      {
        _id: chat._id,
        userId: session.user.id,
      },
      {
        $set: {
          updatedAt,
          lastMessageAt: new Date(),
        },
      }
    );

    return NextResponse.json({
      userMessage,
      assistantMessage,
    });
  } catch (error) {
    console.error("Create message error:", error);

    return NextResponse.json(
      { error: "Failed to process message" },
      { status: 500 }
    );
  }
}