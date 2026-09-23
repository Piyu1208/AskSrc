import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

// POST /api/chat
// Body: {
//   message: string,
//   sourceId?: string,                                   // optional: scope to one ingested source
//   history?: { role: "user" | "assistant"; content: string }[]
// }
//
// This route intentionally has NO retrieval or LLM logic — just request
// parsing/validation. Fill in the marked section with your own flow, e.g.:
//
//   1. Embed `message` with the same model used at ingestion time
//      (see lib/embeddings.ts -> embedText).
//   2. qdrant.search(COLLECTION_NAME, { vector, limit, filter }) from
//      lib/qdrant.ts to get the top-k relevant chunks
//      (optionally filter by payload.sourceId).
//   3. Build a prompt from the retrieved chunks + `message` (+ `history`).
//   4. Call your LLM of choice and stream/return the answer.

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);
    const message = body?.message;
    const sourceId = body?.sourceId as string | undefined;
    const history = body?.history as
      | { role: "user" | "assistant"; content: string }[]
      | undefined;

    if (!message || typeof message !== "string") {
      return NextResponse.json(
        { error: "A 'message' string is required." },
        { status: 400 }
      );
    }

    // --- YOUR RAG + LLM LOGIC GOES HERE ---
    // (retrieve from Qdrant, build context, call the LLM, return the answer)

    void sourceId;
    void history;

    return NextResponse.json(
      { error: "Chat logic not implemented yet." },
      { status: 501 }
    );
  } catch (err: any) {
    console.error("Chat route error:", err);
    return NextResponse.json(
      { error: err?.message || "Failed to process chat request." },
      { status: 500 }
    );
  }
}
