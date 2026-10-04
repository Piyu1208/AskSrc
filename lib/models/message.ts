
import { ObjectId, type Collection } from "mongodb";

export interface MessageSource {
  sourceId: string;
  chunkId?: string;
  pageNumber?: number;
  timestamp?: number;
}

export interface Message {
  _id: ObjectId;
  chatId: ObjectId;
  userId: string;
  role: "user" | "assistant";
  content: string;
  sources: MessageSource[];
  createdAt: Date;
}

export function getMessagesCollection(
  db: Awaited<ReturnType<typeof import("@/lib/db").getDb>>
): Collection<Message> {
  return db.collection<Message>("messages");
}