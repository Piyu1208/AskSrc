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

      {sources.map((s) => (
        <span
          key={s.id}
          className="flex max-w-56 items-center gap-1.5 border border-[#3A372F] bg-[#0D0C09] py-1 pl-2.5 pr-1 text-xs text-[#F3F0E8]"
        >
          {s.status === "processing" ? (
            <Spinner className="h-3 w-3 shrink-0 text-[#8FAAD1]" />
          ) : (
            <Icon name={s.type} className="h-3.5 w-3.5 shrink-0 text-[#8F8A7B]" />
          )}
          <span className="truncate" title={s.name}>
            {s.name}
          </span>
          <button
            type="button"
            onClick={() => onDetach(s.id)}
            aria-label={`Remove ${s.name} from this chat`}
            className="p-0.5 text-[#8F8A7B] transition-colors hover:bg-[#2A281F] hover:text-[#F3F0E8] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#8FAAD1]"
          >
            <Icon name="close" className="h-3 w-3" />
          </button>
        </span>
      ))}

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