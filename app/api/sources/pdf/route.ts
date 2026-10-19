import { NextRequest, NextResponse } from "next/server";

import { getSession } from "@/lib/get-session";
import { createSource } from "@/lib/sources";
import { uploadPdf } from "@/lib/cloudinary";
import { inngest } from "@/lib/inngest/client";

export const runtime = "nodejs";

const MAX_SIZE = 10 * 1024 * 1024;

// --------------------------------------------------
// POST /api/sources/pdf
//
// Body: multipart/form-data
// field: file
//
// Flow:
//   1. Authenticate user
//   2. Get uploaded file
//   3. Validate PDF (type + extension + magic bytes)
//   4. Upload PDF to Cloudinary
//   5. Create MongoDB source record (status: processing)
//   6. Trigger Inngest background job (chunk + embed + Qdrant)
//   7. Return 202 Accepted immediately
// --------------------------------------------------

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
    // 2. Get uploaded file
    // --------------------------------------------------

    const formData = await req.formData();

    const pdfFile = formData.get("file");

    if (!(pdfFile instanceof File)) {
      return NextResponse.json(
        {
          error: "A PDF file is required.",
        },
        { status: 400 }
      );
    }

    // --------------------------------------------------
    // 3. Validate PDF type and extension
    // --------------------------------------------------

    if (
      pdfFile.type !== "application/pdf" ||
      !pdfFile.name.toLowerCase().endsWith(".pdf")
    ) {
      return NextResponse.json(
        {
          error: "Only PDF files are supported.",
        },
        { status: 400 }
      );
    }

    // --------------------------------------------------
    // 4. Check pdf size
    // --------------------------------------------------

    if (pdfFile.size === 0 || pdfFile.size > MAX_SIZE) {
      return NextResponse.json(
        { error: "File size must be within 10MB" },
        { status: 400 }
      );
    }

    // --------------------------------------------------
    // 5. Safety check: verify PDF magic bytes (%PDF-)
    // --------------------------------------------------

    const header = new Uint8Array(
      await pdfFile.slice(0, 5).arrayBuffer()
    );

    if (new TextDecoder().decode(header) !== "%PDF-") {
      return NextResponse.json(
        { error: "Invalid PDF file — failed safety check." },
        { status: 400 }
      );
    }

    // --------------------------------------------------
    // 6. Read the full file into a buffer
    // --------------------------------------------------

    const arrayBuffer = await pdfFile.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // --------------------------------------------------
    // 7. Upload PDF to Cloudinary
    // --------------------------------------------------

    let uploadResult;
    try {
      uploadResult = await uploadPdf(buffer, pdfFile.name);
    } catch (err) {
      console.error("Cloudinary upload error:", err);
      return NextResponse.json(
        { error: "Failed to upload file to cloud storage." },
        { status: 500 }
      );
    }

    // --------------------------------------------------
    // 8. Create MongoDB source record (chunk count = 0 until ingested)
    // --------------------------------------------------

    const source = await createSource(
      userId,
      pdfFile.name,
      "pdf",
      0,
      "processing",
    );

    const sourceId = source.id;

    // --------------------------------------------------
    // 9. Trigger Inngest background job (chunk + embed + Qdrant)
    // --------------------------------------------------

    await inngest.send({
      name: "app/pdf.ingested",
      data: {
        userId,
        sourceId,
        fileName: pdfFile.name,
        cloudinaryUrl: uploadResult.secure_url,
        cloudinaryPublicId: uploadResult.public_id,
      },
    });

    // --------------------------------------------------
    // 10. Return 202 Accepted
    // --------------------------------------------------

    return NextResponse.json(
      {
        success: true,
        status: "processing",
        sourceId,
        fileName: pdfFile.name,
        message:
          "PDF uploaded safely and queued for background ingestion via Inngest.",
      },
      { status: 202 }
    );
  } catch (err: any) {
    console.error("PDF upload error:", err);

    return NextResponse.json(
      { error: "Failed to process PDF." },
      { status: 500 }
    );
  }
}
