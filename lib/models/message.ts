
import { ObjectId, type Collection } from "mongodb";

export type MessageSource =
  | {
      type: "youtube";
      sourceId: string;
      timestampUrl: string;
    }
  | {
      type: "pdf";
      sourceId: string;
      pageNumber: number;
    };

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