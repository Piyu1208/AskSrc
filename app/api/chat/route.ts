import { NextRequest, NextResponse } from "next/server";

import { getSession } from "@/lib/get-session";
import { getDb } from "@/lib/db";
import { main } from "@/lib/rag/main";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    // --------------------------------------------------
    // 1. Authenticate user
    // --------------------------------------------------

    const session = await getSession();

    if (!session) {
      return NextResponse.json(
        {
          error: "Unauthorized.",
        },
        { status: 401 },
      );
    }

    const userId = session.user.id;

    // --------------------------------------------------
    // 2. Parse request
    // --------------------------------------------------

    const body = await req.json().catch(() => null);

    const message = body?.message;
    const sourceId = body?.sourceId;

    // --------------------------------------------------
    // 3. Validate request
    // --------------------------------------------------

    if (
      !message ||
      typeof message !== "string" ||
      !message.trim()
    ) {
      return NextResponse.json(
        {
          error: "A 'message' string is required.",
        },
        { status: 400 },
      );
    }

    if (
      !sourceId ||
      typeof sourceId !== "string"
    ) {
      return NextResponse.json(
        {
          error: "A 'sourceId' string is required.",
        },
        { status: 400 },
      );
    }

    const query = message.trim();

    // --------------------------------------------------
    // 4. Verify source belongs to authenticated user
    // --------------------------------------------------

    const db = await getDb();

    const source = await db.collection("sources").findOne({
      id: sourceId,
      userId,
    });

    if (!source) {
      return NextResponse.json(
        {
          error: "Source not found.",
        },
        { status: 404 },
      );
    }

    // --------------------------------------------------
    // 5. Run RAG pipeline
    // --------------------------------------------------

    const response = await main(
      query,
      userId,
      sourceId,
    );

    // --------------------------------------------------
    // 6. Return response
    // --------------------------------------------------

    return NextResponse.json(response);
  } catch (err: unknown) {
    console.error("Chat route error:", err);

    return NextResponse.json(
      {
        error:
          err instanceof Error
            ? err.message
            : "Failed to process chat request.",
      },
      { status: 500 },
    );
  }
}