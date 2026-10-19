import { NextRequest, NextResponse } from "next/server";

import { getSession } from "@/lib/get-session";
import { getDb } from "@/lib/db";
import { qdrant, COLLECTION_NAME } from "@/lib/rag/qdrant";
import type { Chat } from "@/lib/models/chat";
import { deletePdf } from "@/lib/cloudinary";

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

    // -------------------------------------------------
    // 4. Delete PDF from cloudinary
    // -------------------------------------------------

    if (typeof source.cloudinaryPublicId === "string" && source.cloudinaryPublicId) {
      await deletePdf(source.cloudinaryPublicId);
    }

    // --------------------------------------------------
    // 5. Delete Qdrant vectors
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
    // 6. Delete MongoDB source
    // --------------------------------------------------

    await db.collection("sources").deleteOne({
      id: sourceId,
      userId,
    });

    // 7. Remove source from all of this user's chats
    await db.collection<Chat>("chats").updateMany(
      {
        userId,
        sourceIds: sourceId,
      },
      {
        $pull: {
          sourceIds: sourceId,
        },
      },
    );

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