import { NextRequest, NextResponse } from "next/server";

import { getSession } from "@/lib/get-session";
import { createSource, updateSource } from "@/lib/sources";
import { inngest } from "@/lib/inngest/client";

export const runtime = "nodejs";

function extractVideoId(input: string): string | null {
  try {
    // Allow pasted links without a scheme, e.g. "youtube.com/watch?v=...".
    const normalized = /^https?:\/\//i.test(input)
      ? input
      : `https://${input}`;

    const url = new URL(normalized);
    const host = url.hostname.toLowerCase().replace(/^www\./, "");

    let videoId: string | null = null;

    if (host === "youtu.be") {
      videoId = url.pathname.split("/").filter(Boolean)[0] ?? null;
    } else if (
      host === "youtube.com" ||
      host === "m.youtube.com" ||
      host === "music.youtube.com"
    ) {
      if (url.pathname === "/watch") {
        videoId = url.searchParams.get("v");
      } else {
        const match = url.pathname.match(
          /^\/(?:embed|shorts|live)\/([^/]+)/,
        );
        videoId = match?.[1] ?? null;
      }
    }

    // Standard YouTube video IDs contain 11 URL-safe characters.
    return videoId && /^[\w-]{11}$/.test(videoId) ? videoId : null;
  } catch {
    return null;
  }
}

// POST /api/sources/youtube
// Body: { url: string }

export async function POST(req: NextRequest) {
  try {
    // 1. Authenticate.
    const session = await getSession();

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = session.user.id;

    // 2. Validate the request and URL.
    const body = await req.json().catch(() => null);
    const url = body?.url;

    if (typeof url !== "string" || !url.trim()) {
      return NextResponse.json(
        { error: "A valid 'url' field is required." },
        { status: 400 },
      );
    }

    const videoId = extractVideoId(url.trim());

    if (!videoId) {
      return NextResponse.json(
        { error: "Could not parse a valid YouTube video ID." },
        { status: 400 },
      );
    }

    // Store a canonical URL rather than whatever the user pasted
    // (tracking params, playlist ids, etc.).
    const sourceUrl = `https://www.youtube.com/watch?v=${videoId}`;

    // 3. Create the source before dispatching the job.
    const source = await createSource(userId, videoId, "youtube", 0);
    const sourceId = source.id;

    // Ensure the initial status is processing.
    await updateSource(sourceId, userId, "processing");

    console.log({
      submittedUrl: sourceUrl,
      extractedVideoId: videoId,
    });

    // 4. Trigger background indexing.
    try {
      await inngest.send({
        name: "app/yt-ingested",
        data: {
          sourceId,
          userId,
          videoId,
          sourceUrl,
        },
      });
    } catch (error) {
      // Keep the record visible, but don't leave it processing.
      await updateSource(sourceId, userId, "failed");

      throw error;
    }

    // 5. Return immediately; indexing happens in the background.
    return NextResponse.json(
      {
        success: true,
        sourceId,
        sourceType: "youtube",
        videoId,
        status: "processing",
      },
      { status: 202 },
    );
  } catch (error) {
    console.error("YouTube ingestion request error:", error);

    return NextResponse.json(
      { error: "Failed to queue YouTube indexing." },
      { status: 500 },
    );
  }
}