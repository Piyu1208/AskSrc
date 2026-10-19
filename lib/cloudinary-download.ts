
import { cloudinary } from "@/lib/cloudinary";

export async function downloadFromCloudinary(
  publicId: string,
): Promise<Buffer> {
  const downloadUrl = cloudinary.utils.private_download_url(
    publicId,
    "pdf",
    {
      resource_type: "raw",
      type: "private",
      expires_at: Math.floor(Date.now() / 1000) + 300,
      attachment: true,
    },
  );

  const response = await fetch(downloadUrl);

  if (!response.ok) {
    throw new Error(
      `Failed to download from Cloudinary: ${response.status} ${response.statusText}`,
    );
  }

  return Buffer.from(await response.arrayBuffer());
}
