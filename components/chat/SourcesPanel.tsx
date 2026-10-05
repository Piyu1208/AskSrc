"use client";

import { useRef, useState, type FormEvent } from "react";

import type { Source } from "@/lib/chat/types";
import { SOURCE_DRAG_TYPE } from "@/lib/chat/utils";

import { ConfirmDelete } from "./ConfirmDelete";
import { Icon, Spinner } from "./icons";

type Props = {
  sources: Source[];
  loading: boolean;
  attachedIds: string[];
  isIndexing: boolean;
  deletingId: string | null;
  onClose: () => void;
  onAttach: (id: string) => void;
  onDetach: (id: string) => void;
  onDelete: (id: string) => void;
  onDismiss: (id: string) => void;
  onAddYoutube: (url: string) => void;
  onFiles: (files: File[]) => void;
};

/* ------------------------------ Source row -------------------------------- */

function SourceRow({
  source,
  attached,
  deleting,
  onAttach,
  onDetach,
  onDelete,
  onDismiss,
}: {
  source: Source;
  attached: boolean;
  deleting: boolean;
  onAttach: () => void;
  onDetach: () => void;
  onDelete: () => void;
  onDismiss: () => void;
}) {
  const ready = source.status === "ready";

  return (
    <li
      draggable={ready}
      onDragStart={(e) => {
        e.dataTransfer.setData(SOURCE_DRAG_TYPE, source.id);
        e.dataTransfer.effectAllowed = "copy";
      }}
      className={`group rounded-lg border p-3 transition-colors ${
        attached
          ? "border-teal-700/50 bg-teal-950/20"
          : "border-zinc-800 bg-zinc-900/40 hover:border-zinc-700"
      } ${ready ? "cursor-grab active:cursor-grabbing" : ""}`}
    >
      <div className="flex items-start gap-3">
        <span className="mt-0.5 text-zinc-500">
          <Icon name={source.type} className="h-4 w-4" />
        </span>

        <div className="min-w-0 flex-1">
          <p
            className="truncate text-sm font-medium text-zinc-200"
            title={source.name}
          >
            {source.name}
          </p>

          {source.status === "processing" && (
            <p className="mt-0.5 flex items-center gap-1.5 text-xs text-teal-400">
              <Spinner className="h-3 w-3" />
              {source.type === "pdf"
                ? "Reading and embedding…"
                : "Fetching transcript and embedding…"}
            </p>
          )}

          {ready && (
            <p className="mt-0.5 text-xs text-zinc-500">
              {source.chunks} chunks indexed
            </p>
          )}

          {source.status === "error" && (
            <p className="mt-0.5 flex items-start gap-1.5 text-xs text-red-400">
              <Icon name="alert" className="mt-px h-3.5 w-3.5 shrink-0" />
              {source.error}
            </p>
          )}
        </div>

        {ready && (
          <ConfirmDelete
            label={`Delete ${source.name}`}
            busy={deleting}
            revealOnHover
            onConfirm={onDelete}
          />
        )}

        {source.status === "error" && (
          <button
            type="button"
            onClick={onDismiss}
            aria-label="Dismiss"
            className="rounded-md p-1 text-zinc-500 transition-colors hover:bg-zinc-800 hover:text-zinc-300"
          >
            <Icon name="close" className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {source.status === "processing" && (
        <div className="mt-3 h-1 overflow-hidden rounded-full bg-zinc-800">
          <div className="h-full w-1/2 animate-pulse rounded-full bg-teal-600 motion-reduce:animate-none" />
        </div>
      )}

      {ready && (
        <button
          type="button"
          onClick={attached ? onDetach : onAttach}
          className={`mt-3 flex w-full items-center justify-center gap-1.5 rounded-md border px-2 py-1.5 text-xs font-medium transition-colors ${
            attached
              ? "border-teal-700/50 text-teal-300 hover:border-zinc-700 hover:text-zinc-300"
              : "border-zinc-700 text-zinc-300 hover:border-teal-700 hover:text-teal-300"
          }`}
        >
          <Icon name={attached ? "check" : "plus"} className="h-3.5 w-3.5" />
          {attached ? "In this chat" : "Add to chat"}
        </button>
      )}
    </li>
  );
}

/* --------------------------------- Panel ---------------------------------- */

export function SourcesPanel({
  sources,
  loading,
  attachedIds,
  isIndexing,
  deletingId,
  onClose,
  onAttach,
  onDetach,
  onDelete,
  onDismiss,
  onAddYoutube,
  onFiles,
}: Props) {
  const [url, setUrl] = useState("");
  const [dragging, setDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const attached = new Set(attachedIds);

  function submitYoutube(e: FormEvent) {
    e.preventDefault();
    const value = url.trim();
    if (!value || isIndexing) return;
    setUrl("");
    onAddYoutube(value);
  }

  function pickFiles(list: FileList | null) {
    if (list && list.length > 0) onFiles(Array.from(list));
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  return (
    <aside
      aria-label="Sources"
      className="fixed inset-0 z-40 flex flex-col bg-zinc-950 md:static md:inset-auto md:z-auto md:w-80 md:shrink-0 md:border-l md:border-zinc-800/70"
    >
      <div className="flex items-center justify-between px-4 py-3.5">
        <h2 className="text-sm font-semibold text-zinc-100">Sources</h2>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close sources"
          className="rounded-md p-1.5 text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-zinc-200"
        >
          <Icon name="close" className="h-4 w-4" />
        </button>
      </div>

      <div className="flex-1 space-y-6 overflow-y-auto px-4 pb-5">
        {/* Add new */}
        <section aria-label="Add a new source" className="space-y-3">
          <h3 className="text-[11px] font-medium uppercase tracking-wider text-zinc-500">
            Add new
          </h3>

          <div
            onDragOver={(e) => {
              if (!e.dataTransfer.types.includes("Files")) return;
              e.preventDefault();
              if (!isIndexing) setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragging(false);
              if (!isIndexing) pickFiles(e.dataTransfer.files);
            }}
            className={`rounded-lg border border-dashed p-4 text-center transition-colors ${
              dragging && !isIndexing
                ? "border-teal-600 bg-teal-950/30"
                : "border-zinc-700 bg-zinc-900/40"
            } ${isIndexing ? "opacity-60" : ""}`}
          >
            <input
              ref={fileInputRef}
              id="pdf-input"
              type="file"
              accept="application/pdf"
              multiple
              disabled={isIndexing}
              className="sr-only"
              onChange={(e) => pickFiles(e.target.files)}
            />

            <Icon name="upload" className="mx-auto mb-2 h-5 w-5 text-zinc-500" />

            <label
              htmlFor="pdf-input"
              className={`text-sm font-medium ${
                isIndexing
                  ? "cursor-not-allowed text-zinc-500"
                  : "cursor-pointer text-teal-400 hover:underline"
              }`}
            >
              {isIndexing ? "Indexing…" : "Choose PDFs"}
            </label>
            <p className="mt-1 text-xs text-zinc-500">or drop them here</p>
          </div>

          <form onSubmit={submitYoutube}>
            <label htmlFor="yt-url" className="sr-only">
              YouTube link
            </label>
            <div className="flex gap-2">
              <input
                id="yt-url"
                type="url"
                required
                placeholder="Paste a YouTube link…"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                className="min-w-0 flex-1 rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm placeholder:text-zinc-500 focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-500/30"
              />
              <button
                type="submit"
                disabled={isIndexing || !url.trim()}
                className="rounded-md bg-zinc-100 px-3 py-2 text-sm font-medium text-zinc-900 transition-colors hover:bg-white disabled:cursor-not-allowed disabled:opacity-40"
              >
                Add
              </button>
            </div>
          </form>
        </section>

        {/* Library */}
        <section aria-label="Your sources" className="space-y-3">
          <div className="flex items-baseline justify-between">
            <h3 className="text-[11px] font-medium uppercase tracking-wider text-zinc-500">
              Your sources
            </h3>
            {sources.length > 0 && (
              <span className="hidden text-[11px] text-zinc-600 md:inline">
                Drag onto the chat to add
              </span>
            )}
          </div>

          {loading ? (
            <div className="flex items-center gap-2 text-xs text-zinc-500">
              <Spinner className="h-3.5 w-3.5" />
              Loading sources…
            </div>
          ) : sources.length === 0 ? (
            <p className="text-xs leading-relaxed text-zinc-500">
              Nothing here yet. Add a PDF or YouTube link above.
            </p>
          ) : (
            <ul className="space-y-2">
              {sources.map((source) => (
                <SourceRow
                  key={source.id}
                  source={source}
                  attached={attached.has(source.id)}
                  deleting={deletingId === source.id}
                  onAttach={() => onAttach(source.id)}
                  onDetach={() => onDetach(source.id)}
                  onDelete={() => onDelete(source.id)}
                  onDismiss={() => onDismiss(source.id)}
                />
              ))}
            </ul>
          )}
        </section>
      </div>
    </aside>
  );
}
