import { encoding_for_model } from "tiktoken";

export interface TranscriptItem {
  text: string;
  start: number;
  duration: number;
}

export interface TranscriptChunk {
  text: string;
  startTime: number;
  endTime: number;
}

const encoding = encoding_for_model("text-embedding-3-small");

const TARGET_CHUNK_TOKENS = 450;
const MAX_CHUNK_TOKENS = 600;
const OVERLAP_TOKENS = 75; // ~17%

function tokenCount(text: string): number {
  return encoding.encode(text).length;
}

function cleanText(text: string): string {
  return text
    .replace(/\s+/g, " ")
    .replace(/♪/g, "")
    .trim();
}

export function normalizeTranscript(
  items: TranscriptItem[]
): TranscriptItem[] {
  return items
    .map((item) => ({
      text: cleanText(item.text),
      start: item.start,
      duration: item.duration,
    }))
    .filter((item) => item.text.length > 0);
}

export function chunkTranscript(
  items: TranscriptItem[]
): TranscriptChunk[] {
  const normalized = normalizeTranscript(items);

  const chunks: TranscriptChunk[] = [];

  let currentItems: TranscriptItem[] = [];
  let currentTokens = 0;

  for (const item of normalized) {
    const itemTokens = tokenCount(item.text);

    // Handle an unusually large individual subtitle segment.
    if (itemTokens > MAX_CHUNK_TOKENS) {
      if (currentItems.length > 0) {
        chunks.push(createChunk(currentItems));
        currentItems = [];
        currentTokens = 0;
      }

      chunks.push({
        text: item.text,
        startTime: item.start,
        endTime: item.start + item.duration,
      });

      continue;
    }

    // Adding this item would take us beyond the target.
    if (
      currentItems.length > 0 &&
      currentTokens + itemTokens > TARGET_CHUNK_TOKENS
    ) {
      chunks.push(createChunk(currentItems));

      // Keep the most recent items for overlap.
      const overlapItems: TranscriptItem[] = [];
      let overlapTokens = 0;

      for (let i = currentItems.length - 1; i >= 0; i--) {
        const tokens = tokenCount(currentItems[i].text);

        if (overlapTokens + tokens > OVERLAP_TOKENS) {
          break;
        }

        overlapItems.unshift(currentItems[i]);
        overlapTokens += tokens;
      }

      currentItems = overlapItems;
      currentTokens = overlapTokens;
    }

    currentItems.push(item);
    currentTokens += itemTokens;
  }

  if (currentItems.length > 0) {
    chunks.push(createChunk(currentItems));
  }

  return chunks;
}

function createChunk(items: TranscriptItem[]): TranscriptChunk {
  return {
    text: items.map((item) => item.text).join(" "),
    startTime: items[0].start,
    endTime: items[items.length - 1].start + items[items.length - 1].duration,
  };
}