import { NextResponse } from "next/server";

import { getSession } from "@/lib/get-session";
import { getSourcesByUser } from "@/lib/sources";

export async function GET() {
  try {
    const session = await getSession();

    if (!session) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const sources = await getSourcesByUser(
      session.user.id
    );

    return NextResponse.json({
      sources,
    });
  } catch (error) {
    console.error("Get sources error:", error);

    return NextResponse.json(
      { error: "Failed to fetch sources." },
      { status: 500 }
    );
  }
}