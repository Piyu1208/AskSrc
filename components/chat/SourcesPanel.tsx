"use client";

import { useRef, useState, type FormEvent } from "react";

import type { Source } from "@/lib/chat/types";
import { SOURCE_DRAG_TYPE } from "@/lib/chat/utils";

import { ConfirmDelete } from "./ConfirmDelete";
import { Icon, Spinner } from "./icons";

const SERIF = { fontFamily: "'Source Serif 4', Georgia, serif" };

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
  const ready = source.status === "completed";

  return (
    <li
      draggable={ready}
      onDragStart={(e) => {
        e.dataTransfer.setData(SOURCE_DRAG_TYPE, source.id);
        e.dataTransfer.effectAllowed = "copy";
      }}
      className={`group border p-3 transition-colors ${
        attached
          ? "border-[#8FAAD1]/60 bg-[#8FAAD1]/5"
          : "border-[#2A281F] bg-[#0D0C09] hover:border-[#3A372F]"
      } ${ready ? "cursor-grab active:cursor-grabbing" : ""}`}
    >
      <div className="flex items-start gap-3">
        <span className="mt-0.5 text-[#8F8A7B]">
          <Icon name={source.type} className="h-4 w-4" />
        </span>

        <div className="min-w-0 flex-1">
          <p
            className="truncate text-sm text-[#F3F0E8]"
            title={source.name}
          >
            {source.name}
          </p>

          {source.status === "processing" && (
            <p className="mt-0.5 flex items-center gap-1.5 text-xs text-[#8FAAD1]">
              <Spinner className="h-3 w-3" />
              {source.type === "pdf"
                ? "Reading and embedding…"
                : "Fetching transcript and embedding…"}
            </p>
          )}

          {ready && (
            <p className="mt-0.5 text-xs text-[#8F8A7B]">
              {source.chunks} chunks indexed
            </p>
          )}

          {source.status === "failed" && (
            <p className="mt-0.5 flex items-start gap-1.5 border-l-2 border-[#E2725B] pl-2 text-xs text-[#E2725B]">
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

        {source.status === "failed" && (
          <button
            type="button"
            onClick={onDismiss}
            aria-label="Dismiss"
            className="p-1 text-[#8F8A7B] transition-colors hover:bg-[#2A281F] hover:text-[#F3F0E8] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#8FAAD1]"
          >
            <Icon name="close" className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {source.status === "processing" && (
        <div className="mt-3 h-1 overflow-hidden bg-[#2A281F]">
          <div className="h-full w-1/2 animate-pulse bg-[#8FAAD1] motion-reduce:animate-none" />
        </div>
      )}

      {ready && (
        <button
          type="button"
          onClick={attached ? onDetach : onAttach}
          className={`mt-3 flex w-full items-center justify-center gap-1.5 border px-2 py-1.5 text-xs transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#8FAAD1] ${
            attached
              ? "border-[#8FAAD1] text-[#8FAAD1] hover:border-[#3A372F] hover:text-[#8F8A7B]"
              : "border-[#3A372F] text-[#F3F0E8] hover:border-[#F3F0E8] hover:bg-[#F3F0E8] hover:text-[#14130F]"
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
      className="fixed inset-0 z-40 flex flex-col bg-[#14130F] font-sans text-[#F3F0E8] md:static md:inset-auto md:z-auto md:w-80 md:shrink-0 md:border-l md:border-[#2A281F]"
    >
      <div className="flex items-center justify-between px-4 py-3.5">
        <h2 className="text-lg text-[#F3F0E8]" style={SERIF}>
          Sources
        </h2>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close sources"
          className="p-1.5 text-[#8F8A7B] transition-colors hover:bg-[#2A281F] hover:text-[#F3F0E8] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#8FAAD1]"
        >
          <Icon name="close" className="h-4 w-4" />
        </button>
      </div>

      <div className="flex-1 space-y-6 overflow-y-auto px-4 pb-5">
        {/* Add new */}
        <section aria-label="Add a new source" className="space-y-3">
          <h3 className="text-[11px] uppercase tracking-wider text-[#5C594C]">
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
            className={`border border-dashed p-4 text-center transition-colors ${
              dragging && !isIndexing
                ? "border-[#8FAAD1] bg-[#8FAAD1]/10"
                : "border-[#3A372F] bg-[#0D0C09]"
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

            <Icon name="upload" className="mx-auto mb-2 h-5 w-5 text-[#8F8A7B]" />

            <label
              htmlFor="pdf-input"
              className={`text-sm ${
                isIndexing
                  ? "cursor-not-allowed text-[#5C594C]"
                  : "cursor-pointer text-[#F3F0E8] underline decoration-[#3A372F] underline-offset-2 hover:decoration-[#F3F0E8]"
              }`}
            >
              {isIndexing ? "Indexing…" : "Choose PDFs"}
            </label>
            <p className="mt-1 text-xs text-[#8F8A7B]">or drop them here</p>
          </div>

          <form onSubmit={submitYoutube}>
            <label htmlFor="yt-url" className="sr-only">
              YouTube link
            </label>
            <div className="flex items-end gap-3">
              <input
                id="yt-url"
                type="url"
                required
                placeholder="Paste a YouTube link…"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                className="min-w-0 flex-1 border-b border-[#3A372F] bg-transparent py-2 text-[15px] text-[#F3F0E8] outline-none transition-colors placeholder:text-[#5C594C] focus-visible:border-[#8FAAD1]"
              />
              <button
                type="submit"
                disabled={isIndexing || !url.trim()}
                className="bg-[#F3F0E8] px-3 py-2 text-sm text-[#14130F] transition-colors hover:bg-[#8FAAD1] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#8FAAD1] disabled:cursor-not-allowed disabled:opacity-40"
              >
                Add
              </button>
            </div>
          </form>
        </section>

        {/* Library */}
        <section aria-label="Your sources" className="space-y-3">
          <div className="flex items-baseline justify-between">
            <h3 className="text-[11px] uppercase tracking-wider text-[#5C594C]">
              Your sources
            </h3>
            {sources.length > 0 && (
              <span className="hidden text-[11px] text-[#5C594C] md:inline">
                Drag onto the chat to add
              </span>
            )}
          </div>

          {loading ? (
            <div className="flex items-center gap-2 text-xs text-[#8F8A7B]">
              <Spinner className="h-3.5 w-3.5" />
              Loading sources…
            </div>
          ) : sources.length === 0 ? (
            <p className="text-xs leading-relaxed text-[#8F8A7B]">
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