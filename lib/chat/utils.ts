import type { Chat } from "./types";

/** MIME-ish key used when dragging an existing source from the library onto the chat. */
export const SOURCE_DRAG_TYPE = "application/x-source-id";

export const RETRIEVAL_PHASE_MS = 1600;

export const SUGGESTIONS = [
  "Summarize the main points",
  "What are the key takeaways?",
  "List any important names, dates or numbers",
];

export const uid = () => Math.random().toString(36).slice(2, 10);

export function errorMessage(err: unknown, fallback: string) {
  return err instanceof Error && err.message ? err.message : fallback;
}

export function youtubeLabel(url: string) {
  try {
    const u = new URL(url);
    const id =
      u.searchParams.get("v") ?? u.pathname.split("/").filter(Boolean).pop();
    return id ? `YouTube · ${id}` : u.hostname;
  } catch {
    return url;
  }
}

export function isPdf(file: File) {
  return (
    file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")
  );
}

export function formatTimestamp(totalSeconds: number) {
  const s = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = String(s % 60).padStart(2, "0");
  return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${sec}` : `${m}:${sec}`;
}

/** Groups chats into Today / Yesterday / Previous 7 days / Older, newest first. */
export function groupChatsByDate(chats: Chat[]) {
  const sorted = [...chats].sort(
    (a, b) =>
      new Date(b.lastMessageAt || b.updatedAt).getTime() -
      new Date(a.lastMessageAt || a.updatedAt).getTime(),
  );

  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const day = 24 * 60 * 60 * 1000;

  const buckets: { label: string; items: Chat[] }[] = [
    { label: "Today", items: [] },
    { label: "Yesterday", items: [] },
    { label: "Previous 7 days", items: [] },
    { label: "Older", items: [] },
  ];

  for (const chat of sorted) {
    const t = new Date(chat.lastMessageAt || chat.updatedAt).getTime();
    const age = startOfToday.getTime() - t;
    if (age <= 0) buckets[0].items.push(chat);
    else if (age <= day) buckets[1].items.push(chat);
    else if (age <= 7 * day) buckets[2].items.push(chat);
    else buckets[3].items.push(chat);
  }

  return buckets.filter((b) => b.items.length > 0);
}
