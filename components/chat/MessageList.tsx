"use client";

import { useEffect, useRef, useState } from "react";

import type {
  AssistantPhase,
  ChatMessage,
  MessageCitation,
  Source,
} from "@/lib/chat/types";
import { SUGGESTIONS, formatTimestamp } from "@/lib/chat/utils";

import { Icon, Spinner } from "./icons";

const PHASE_TEXT: Record<AssistantPhase, string> = {
  retrieving: "Searching your sources for relevant passages…",
  generating: "Writing an answer…",
};

function citationLabel(c: MessageCitation, name?: string) {
  const base = name ?? (c.type === "pdf" ? "PDF" : "YouTube");
  if (c.type === "pdf" && c.pageNumber != null) return `${base} · p.${c.pageNumber}`;
  if (c.type === "youtube" && c.startTime != null)
    return `${base} · ${formatTimestamp(c.startTime)}`;
  return base;
}

function TypingDots() {
  return (
    <span className="inline-flex items-center gap-1" aria-hidden="true">
      {[0, 150, 300].map((d) => (
        <span
          key={d}
          className="h-1.5 w-1.5 animate-bounce rounded-full bg-teal-400/70 motion-reduce:animate-none"
          style={{ animationDelay: `${d}ms` }}
        />
      ))}
    </span>
  );
}

function Avatar({ error = false }: { error?: boolean }) {
  return (
    <div
      className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
        error ? "bg-red-950 text-red-400" : "bg-teal-700 text-white"
      }`}
      aria-hidden="true"
    >
      {error ? "!" : "AI"}
    </div>
  );
}

type Props = {
  messages: ChatMessage[];
  loading: boolean;
  phase: AssistantPhase | null;
  sourceMap: Map<string, Source>;
  attachedCount: number;
  canChat: boolean;
  processing: boolean;
  onSuggestion: (text: string) => void;
  onOpenPanel: () => void;
};

export function MessageList({
  messages,
  loading,
  phase,
  sourceMap,
  attachedCount,
  canChat,
  processing,
  onSuggestion,
  onOpenPanel,
}: Props) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, phase]);

  async function copy(m: ChatMessage) {
    try {
      await navigator.clipboard.writeText(m.content);
      setCopiedId(m.id);
      window.setTimeout(() => setCopiedId(null), 1500);
    } catch {
      /* clipboard unavailable */
    }
  }

  const empty = messages.length === 0 && !loading && !phase;

  return (
    <div className="flex-1 overflow-y-auto px-4 py-6">
      <div className="mx-auto max-w-2xl space-y-6">
        {loading && (
          <div className="flex justify-center pt-16 text-zinc-500">
            <Spinner className="h-5 w-5" />
          </div>
        )}

        {empty && (
          <div className="pt-16 text-center">
            <h2 className="text-lg font-semibold text-zinc-100">
              {canChat
                ? "What would you like to know?"
                : attachedCount > 0 && processing
                  ? "Getting your source ready"
                  : "Add a source to this chat"}
            </h2>

            <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-zinc-400">
              {canChat
                ? "Ask a question and I'll answer from the sources in this chat."
                : attachedCount > 0 && processing
                  ? "You can start asking questions as soon as it has finished embedding."
                  : "Pick one from your library, upload a PDF, paste a YouTube link, or drag a file anywhere onto this chat."}
            </p>

            {canChat ? (
              <div className="mt-5 flex flex-wrap justify-center gap-2">
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => onSuggestion(s)}
                    className="rounded-full border border-zinc-700 bg-zinc-900 px-3.5 py-1.5 text-sm text-zinc-300 transition-colors hover:border-teal-600 hover:text-teal-300"
                  >
                    {s}
                  </button>
                ))}
              </div>
            ) : processing ? (
              <div className="mt-5 flex justify-center text-teal-400">
                <Spinner className="h-5 w-5" />
              </div>
            ) : (
              <button
                type="button"
                onClick={onOpenPanel}
                className="mt-5 inline-flex items-center gap-1.5 rounded-lg bg-zinc-100 px-3.5 py-2 text-sm font-medium text-zinc-900 transition-colors hover:bg-white"
              >
                <Icon name="plus" className="h-4 w-4" />
                Add source
              </button>
            )}
          </div>
        )}

        {messages.map((m) => {
          if (m.role === "user") {
            return (
              <div key={m.id} className="flex justify-end">
                <div className="max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-br-md bg-zinc-800 px-4 py-2.5 text-sm leading-relaxed text-zinc-100">
                  {m.content}
                </div>
              </div>
            );
          }

          const labels = Array.from(
            new Set(
              (m.sources ?? []).map((c) =>
                citationLabel(c, sourceMap.get(c.sourceId)?.name),
              ),
            ),
          );

          return (
            <div key={m.id} className="group flex gap-3">
              <Avatar error={m.isError} />

              <div className="min-w-0 flex-1">
                <div
                  className={`whitespace-pre-wrap text-sm leading-relaxed ${
                    m.isError ? "text-red-400" : "text-zinc-200"
                  }`}
                >
                  {m.content}
                </div>

                {labels.length > 0 && (
                  <div className="mt-2.5 flex flex-wrap gap-1.5">
                    {labels.map((label) => (
                      <span
                        key={label}
                        className="max-w-full truncate rounded-md border border-zinc-800 bg-zinc-900 px-2 py-0.5 text-[11px] text-zinc-400"
                        title={label}
                      >
                        {label}
                      </span>
                    ))}
                  </div>
                )}

                {!m.isError && (
                  <button
                    type="button"
                    onClick={() => copy(m)}
                    className="mt-1.5 flex items-center gap-1 text-xs text-zinc-500 transition-opacity hover:text-zinc-300 focus:opacity-100 md:opacity-0 md:group-hover:opacity-100"
                  >
                    <Icon name="copy" className="h-3.5 w-3.5" />
                    {copiedId === m.id ? "Copied" : "Copy"}
                  </button>
                )}
              </div>
            </div>
          );
        })}

        {phase && (
          <div className="flex gap-3" role="status" aria-live="polite">
            <Avatar />
            <div className="flex items-center gap-2.5 pt-1 text-sm text-zinc-400">
              <TypingDots />
              <span>{PHASE_TEXT[phase]}</span>
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>
    </div>
  );
}
