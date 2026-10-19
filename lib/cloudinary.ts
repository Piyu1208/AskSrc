import { v2 as cloudinary } from "cloudinary";
import type { UploadApiResponse } from "cloudinary";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

export interface UploadResult {
  secure_url: string;
  public_id: string;
  bytes: number;
  format: string;
}

/**
 * Upload a PDF buffer to Cloudinary as a raw file.
 * Returns the secure URL and public id for later retrieval.
 */
export async function uploadPdf(
  buffer: Buffer,
  filename: string,
): Promise<UploadResult> {
  const base64 = buffer.toString("base64");
  const dataUri = `data:application/pdf;base64,${base64}`;

  const result = (await cloudinary.uploader.upload(dataUri, {
    resource_type: "raw",
    folder: "asksource/pdfs",
    public_id: `pdf_${Date.now()}_${filename.replace(/\s+/g, "_")}`,
    type: "private",
  })) as UploadApiResponse;

  return {
    secure_url: result.secure_url,
    public_id: result.public_id,
    bytes: result.bytes,
    format: result.format,
  };
}

/**
 * Delete a previously uploaded PDF from Cloudinary by public id.
 */
export async function deletePdf(publicId: string): Promise<void> {
  await cloudinary.uploader.destroy(publicId, {
    resource_type: "raw",
  });
}

export { cloudinary };