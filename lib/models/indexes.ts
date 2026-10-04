
import { getDb } from "@/lib/db";

export async function createChatIndexes() {
  const db = await getDb();

  const chats = db.collection("chats");
  const messages = db.collection("messages");

  await Promise.all([
    chats.createIndex({ userId: 1, updatedAt: -1 }),
    messages.createIndex({ chatId: 1, createdAt: 1 }),
    messages.createIndex({ userId: 1, chatId: 1 }),
  ]);
}