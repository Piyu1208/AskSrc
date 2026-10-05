export type SourceStatus = "processing" | "ready" | "error";

export type Source = {
  id: string;
  type: "youtube" | "pdf";
  name: string;
  status: SourceStatus;
  chunks?: number;
  error?: string;
};

export type MessageCitation = {
  type: "pdf" | "youtube";
  sourceId: string;
  pageNumber?: number;
  startTime?: number;
};

export type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  sources?: MessageCitation[];
  createdAt?: string;
  isError?: boolean;
};

export type Chat = {
  id: string;
  title: string;
  sourceIds: string[];
  createdAt: string;
  updatedAt: string;
  lastMessageAt: string;
};

export type AssistantPhase = "retrieving" | "generating";
