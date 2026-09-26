import { NextRequest, NextResponse } from "next/server";

import { getSession } from "@/lib/get-session";
import { getDb } from "@/lib/db";
import { qdrant, COLLECTION_NAME } from "@/lib/qdrant";

type RouteContext = {
  params: Promise<{
    sourceId: string;
  }>;
};

export async function DELETE(
  req: NextRequest,
  context: RouteContext,
) {
  try {
    // --------------------------------------------------
    // 1. Authenticate user
    // --------------------------------------------------

    const session = await getSession();

    if (!session) {
      return NextResponse.json(
        { error: "Unauthorized." },
        { status: 401 },
      );
    }

    const userId = session.user.id;

    // --------------------------------------------------
    // 2. Get sourceId from URL
    // --------------------------------------------------

    const { sourceId } = await context.params;

    if (!sourceId) {
      return NextResponse.json(
        { error: "Source ID is required." },
        { status: 400 },
      );
    }

    // --------------------------------------------------
    // 3. Verify source belongs to user
    // --------------------------------------------------

    const db = await getDb();

    const source = await db.collection("sources").findOne({
      id: sourceId,
      userId,
    });

    if (!source) {
      return NextResponse.json(
        { error: "Source not found." },
        { status: 404 },
      );
    }

    // --------------------------------------------------
    // 4. Delete Qdrant vectors
    // --------------------------------------------------

    await qdrant.delete(COLLECTION_NAME, {
      wait: true,
      filter: {
        must: [
          {
            key: "userId",
            match: {
              value: userId,
            },
          },
          {
            key: "sourceId",
            match: {
              value: sourceId,
            },
          },
        ],
      },
    });

    // --------------------------------------------------
    // 5. Delete MongoDB source
    // --------------------------------------------------

    await db.collection("sources").deleteOne({
      id: sourceId,
      userId,
    });

    return NextResponse.json({
      success: true,
      sourceId,
    });
  } catch (error) {
    console.error("Delete source error:", error);

    return NextResponse.json(
      {
        error: "Failed to delete source.",
      },
      { status: 500 },
    );
  }
}