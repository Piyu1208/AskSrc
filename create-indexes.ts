import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

async function main() {
  const { ensurePayloadIndexes } = await import("./lib/rag/qdrant");

  await ensurePayloadIndexes();

  console.log("Payload indexes created successfully");
}

main().catch((error) => {
  console.error("Failed to create payload indexes:", error);
  process.exit(1);
});