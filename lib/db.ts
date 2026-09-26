import clientPromise from "@/lib/mongodb";

export async function getDb() {
  const client = await clientPromise;
  return client.db("AskSource");
}