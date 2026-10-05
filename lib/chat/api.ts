import type {
  Chat,
  ChatMessage,
  MessageCitation,
  Source,
} from "./types";

/* -------------------------------------------------------------------------- */
/* Fetch wrapper                                                              */
/* -------------------------------------------------------------------------- */

export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  const data = (await res.json().catch(() => null)) as
    | (T & { error?: string })
    | null;

  if (!res.ok) {
    throw new ApiError(data?.error ?? `Request failed (${res.status})`, res.status);
  }

  return data as T;
}

const json = (method: string, body: unknown): RequestInit => ({
  method,
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
});

/* -------------------------------------------------------------------------- */
/* Raw shapes returned by the API                                             */
/* -------------------------------------------------------------------------- */

type RawSource = {
  id: string;
  name: string;
  type: "youtube" | "pdf";
  chunks: number;
};

type RawChat = {
  _id: string;
  title: string;
  sourceIds?: string[];
  createdAt: string;
  updatedAt: string;
  lastMessageAt?: string;
};

type RawMessage = {
  _id: string;
  role: "user" | "assistant";
  content: string;
  sources?: MessageCitation[];
  createdAt: string;
};

type IngestResult = {
  sourceId: string;
  chunksIndexed: number;
  fileName?: string;
};

const toChat = (c: RawChat): Chat => ({
  id: c._id,
  title: c.title,
  sourceIds: (c.sourceIds ?? []).map(String),
  createdAt: c.createdAt,
  updatedAt: c.updatedAt,
  lastMessageAt: c.lastMessageAt ?? c.updatedAt,
});

const toMessage = (m: RawMessage): ChatMessage => ({
  id: m._id,
  role: m.role,
  content: m.content,
  sources: m.sources,
  createdAt: m.createdAt,
});

/* -------------------------------------------------------------------------- */
/* Sources                                                                    */
/* -------------------------------------------------------------------------- */

export async function listSources(): Promise<Source[]> {
  const data = await request<{ sources: RawSource[] }>("/api/sources");
  return data.sources.map((s) => ({
    id: s.id,
    name: s.name,
    type: s.type,
    status: "ready" as const,
    chunks: s.chunks,
  }));
}

export function addYoutubeSource(url: string) {
  return request<IngestResult>("/api/sources/youtube", json("POST", { url }));
}

export function addPdfSource(file: File) {
  const formData = new FormData();
  formData.append("file", file);
  return request<IngestResult>("/api/sources/pdf", {
    method: "POST",
    body: formData,
  });
}

export function deleteSource(id: string) {
  return request<unknown>(`/api/sources/${id}`, { method: "DELETE" });
}

/* -------------------------------------------------------------------------- */
/* Chats                                                                      */
/* -------------------------------------------------------------------------- */

export async function listChats(): Promise<Chat[]> {
  const data = await request<{ chats: RawChat[] }>("/api/chats");
  return data.chats.map(toChat);
}

export async function createChat(title: string): Promise<Chat> {
  const data = await request<{ chat: RawChat }>(
    "/api/chats",
    json("POST", { title }),
  );
  return toChat(data.chat);
}

export async function getChatMessages(chatId: string): Promise<ChatMessage[]> {
  const data = await request<{ messages: RawMessage[] }>(
    `/api/chats/${chatId}`,
  );
  return data.messages.map(toMessage);
}

export function updateChatSources(chatId: string, sourceIds: string[]) {
  return request<unknown>(`/api/chats/${chatId}`, json("PATCH", { sourceIds }));
}

export function deleteChat(chatId: string) {
  return request<unknown>(`/api/chats/${chatId}`, { method: "DELETE" });
}

export async function sendChatMessage(chatId: string, content: string) {
  const data = await request<{
    userMessage: RawMessage;
    assistantMessage: RawMessage;
  }>(`/api/chats/${chatId}/messages`, json("POST", { content }));

  return {
    user: toMessage(data.userMessage),
    assistant: toMessage(data.assistantMessage),
  };
}
