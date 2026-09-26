import { NextRequest, NextResponse } from "next/server";
import { YoutubeTranscript } from "youtube-transcript";
import { v4 as uuidv4 } from "uuid";

import {
  qdrant,
  ensureCollection,
  COLLECTION_NAME,
} from "@/lib/qdrant";

import { embedTexts } from "@/lib/embeddings";

import {
  chunkTranscript,
  type TranscriptItem,
} from "@/lib/chunk";

import { getSession } from "@/lib/get-session";
import { createSource } from "@/lib/sources";
import { getDb } from "@/lib/db";

export const runtime = "nodejs";

function extractVideoId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=)([^&]+)/,
    /(?:youtu\.be\/)([^?]+)/,
    /(?:youtube\.com\/embed\/)([^?]+)/,
    /(?:youtube\.com\/shorts\/)([^?]+)/,
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);

    if (match) {
      return match[1];
    }
  }

  return null;
}

function createTimestampUrl(
  videoId: string,
  startTime: number
): string {
  return `https://www.youtube.com/watch?v=${videoId}&t=${Math.floor(
    startTime
  )}s`;
}

// POST /api/sources/youtube
// Body: { url: string }

export async function POST(req: NextRequest) {
  try {
    // --------------------------------------------------
    // 1. Authenticate user
    // --------------------------------------------------

    const session = await getSession();

    if (!session) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const userId = session.user.id;

    // --------------------------------------------------
    // 2. Validate request
    // --------------------------------------------------

    const body = await req.json().catch(() => null);
    const url = body?.url;

    if (!url || typeof url !== "string") {
      return NextResponse.json(
        { error: "A valid 'url' field is required." },
        { status: 400 }
      );
    }

    // --------------------------------------------------
    // 3. Extract video ID
    // --------------------------------------------------

    const videoId = extractVideoId(url);

    if (!videoId) {
      return NextResponse.json(
        {
          error:
            "Could not parse a YouTube video ID from that URL.",
        },
        { status: 400 }
      );
    }

    // --------------------------------------------------
    // 4. Fetch captions
    // --------------------------------------------------

    const transcript =
      await YoutubeTranscript.fetchTranscript(videoId);

    if (!transcript || transcript.length === 0) {
      return NextResponse.json(
        {
          error:
            "No captions/transcript available for this video.",
        },
        { status: 422 }
      );
    }

    const transcriptItems: TranscriptItem[] = transcript.map(
      (item) => ({
        text: item.text,
        start: item.offset / 1000,
        duration: item.duration / 1000,
      })
    );

    // --------------------------------------------------
    // 5. Chunk transcript
    // --------------------------------------------------

    const chunks = chunkTranscript(transcriptItems);

    if (chunks.length === 0) {
      return NextResponse.json(
        {
          error: "Transcript produced no usable chunks.",
        },
        { status: 422 }
      );
    }

    // --------------------------------------------------
    // 6. Generate embeddings
    // --------------------------------------------------

    const texts = chunks.map((chunk) => chunk.text);

    const vectors = await embedTexts(texts);

    if (vectors.length !== chunks.length) {
      throw new Error(
        "Embedding count does not match chunk count."
      );
    }

    // --------------------------------------------------
    // 7. Create source
    // --------------------------------------------------

    const source = await createSource(
      userId,
      videoId,
      "youtube",
      chunks.length,
    );

    const sourceId = source.id;

    const db = await getDb();

    try {
      // --------------------------------------------------
      // 8. Ensure Qdrant collection
      // --------------------------------------------------

      await ensureCollection();

      // --------------------------------------------------
      // 9. Create Qdrant points
      // --------------------------------------------------

      const points = chunks.map((chunk, index) => ({
        id: uuidv4(),

        vector: vectors[index],

        payload: {
          // Ownership
          userId,
          sourceId,

          // Source information
          sourceType: "youtube" as const,
          sourceUrl: url,
          videoId,

          // Chunk information
          chunkIndex: index,
          text: chunk.text,

          // Timestamp information
          startTime: chunk.startTime,
          endTime: chunk.endTime,
          timestampUrl: createTimestampUrl(
            videoId,
            chunk.startTime
          ),
        },
      }));

      // --------------------------------------------------
      // 10. Store in Qdrant
      // --------------------------------------------------

      await qdrant.upsert(COLLECTION_NAME, {
        wait: true,
        points,
      });
    } catch (error) {
      await db.collection("sources").deleteOne({
        id: sourceId,
        userId,
      });

      throw error;
    }



    // --------------------------------------------------
    // 11. Return result
    // --------------------------------------------------

    return NextResponse.json({
      success: true,
      sourceId,
      sourceType: "youtube",
      videoId,
      chunksIndexed: chunks.length,
    });
  } catch (err: any) {
    console.error("YouTube ingestion error:", err);

    return NextResponse.json(
      {
        error:
          err?.message ||
          "Failed to process YouTube link.",
      },
      { status: 500 }
    );
  }
}