import { QdrantClient } from "@qdrant/js-client-rest";

export const COLLECTION_NAME = "sources";

export const qdrant = new QdrantClient({
  url: "http://localhost:6333",
});

export async function ensureCollection() {
  const collections = await qdrant.getCollections();

  const exists = collections.collections.some(
    (collection) => collection.name === COLLECTION_NAME
  );

  if (exists) return;

  await qdrant.createCollection(COLLECTION_NAME, {
    vectors: {
      size: 1536,
      distance: "Cosine",
    },
  });
}