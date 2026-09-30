import { QdrantClient } from "@qdrant/js-client-rest";

export const COLLECTION_NAME = "sources";

export const qdrant = new QdrantClient({
  url: process.env.QDRANT_CLUSTER_ENDPOINT,
  apiKey: process.env.QDRANT_API_KEY,
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

export async function ensurePayloadIndexes() {
  await qdrant.createPayloadIndex(COLLECTION_NAME, {
    field_name: "userId",
    field_schema: "keyword",
  });

  await qdrant.createPayloadIndex(COLLECTION_NAME, {
    field_name: "sourceId",
    field_schema: "keyword",
  });
}