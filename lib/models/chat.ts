import { ObjectId, type Collection } from "mongodb";

export interface Chat {
  _id: ObjectId;
  userId: string;
  title: string;
  sourceIds: string[];
  createdAt: Date;
  updatedAt: Date;
  lastMessageAt: Date | null;
}

export function getChatsCollection(db: Awaited<ReturnType<typeof import("@/lib/db").getDb>>): Collection<Chat> {
  return db.collection<Chat>("chats");
}