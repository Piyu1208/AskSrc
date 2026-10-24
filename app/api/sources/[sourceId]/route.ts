import { NextRequest, NextResponse } from "next/server";

import { getSession } from "@/lib/get-session";
import { getDb } from "@/lib/db";
import { inngest } from "@/lib/inngest/client";

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

    if (source.status === "deleting") {
      return NextResponse.json(
        { error: "Source deletion is already in progress." },
        { status: 409 },
      );
    }

    if (source.status === "processing") {
      return NextResponse.json(
        { error: "Cannot delete a source while it is processing." },
        { status: 409 },
      );
    }

    // 4. Mark source as deleting
    const updateResult = await db.collection("sources").updateOne(
      {
        id: sourceId,
        userId,
        status: source.status,
      },
      {
        $set: { status: "deleting" },
      },
    );

    if (updateResult.modifiedCount !== 1) {
      return NextResponse.json(
        { error: "Source status changed. Please try again." },
        { status: 409 },
      );
    }

    // 5. Trigger deletion background job
    try {
      await inngest.send({
        name: "source/delete.requested",
        data: {
          userId,
          sourceId,
        },
      });
    } catch (error) {
      // Restore the previous status if the event cannot be sent.
      await db.collection("sources").updateOne(
        {
          id: sourceId,
          userId,
          status: "deleting",
        },
        {
          $set: { status: source.status },
        },
      );

      throw error;
    }

    return NextResponse.json(
      {
        success: true,
        sourceId,
        status: "deleting",
      },
      { status: 202 },
    );
  } catch (error) {
    console.error("Delete source error:", error);

    return NextResponse.json(
      {
        error: "Failed to mark source for deletion.",
      },
      { status: 500 },
    );
  }
}