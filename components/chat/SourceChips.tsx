
"use client";

import type { Source } from "@/lib/chat/types";

import { Icon, Spinner } from "./icons";

export function SourceChips({
  sources,
  onDetach,
  onOpenPanel,
}: {
  sources: Source[];
  onDetach: (id: string) => void;
  onOpenPanel: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2 font-sans">
      {sources.length === 0 && (
        <span className="text-xs text-[#8F8A7B]">
          No sources in this chat yet
        </span>
      )}

      {sources.map((s) => {
        const status = s.status ?? "completed";

        return (
          <span
            key={s.id}
            title={
              status === "processing"
                ? "Indexing source..."
                : status === "failed"
                  ? "Indexing failed"
                  : s.name
            }
            className={`flex max-w-56 items-center gap-1.5 border bg-[#0D0C09] py-1 pl-2.5 pr-1 text-xs ${
              status === "failed"
                ? "border-[#8B4545] text-[#E7A0A0]"
                : status === "processing"
                  ? "border-[#3A372F] text-[#F3F0E8]"
                  : "border-[#3A372F] text-[#F3F0E8]"
            }`}
          >
            {status === "processing" ? (
              <Spinner className="h-3 w-3 shrink-0 text-[#8FAAD1]" />
            ) : status === "failed" ? (
              <Icon
                name="close"
                className="h-3 w-3 shrink-0 text-[#E7A0A0]"
              />
            ) : (
              <Icon
                name={s.type}
                className="h-3.5 w-3.5 shrink-0 text-[#8F8A7B]"
              />
            )}

            <span className="truncate" title={s.name}>
              {s.name}
            </span>

            {status === "failed" && (
              <span className="shrink-0 text-[10px]">
                Failed
              </span>
            )}

            <button
              type="button"
              onClick={() => onDetach(s.id)}
              aria-label={`Remove ${s.name} from this chat`}
              className="p-0.5 text-[#8F8A7B] transition-colors hover:bg-[#2A281F] hover:text-[#F3F0E8] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#8FAAD1]"
            >
              <Icon name="close" className="h-3 w-3" />
            </button>
          </span>
        );
      })}

      <button
        type="button"
        onClick={onOpenPanel}
        className="flex items-center gap-1 border border-dashed border-[#3A372F] px-2.5 py-1 text-xs text-[#8F8A7B] transition-colors hover:border-[#8FAAD1] hover:text-[#8FAAD1] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#8FAAD1]"
      >
        <Icon name="plus" className="h-3 w-3" />
        Add source
      </button>
    </div>
  );
}
