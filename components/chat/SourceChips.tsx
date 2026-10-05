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
    <div className="flex flex-wrap items-center gap-2">
      {sources.length === 0 && (
        <span className="text-xs text-zinc-500">
          No sources in this chat yet
        </span>
      )}

      {sources.map((s) => (
        <span
          key={s.id}
          className="flex max-w-56 items-center gap-1.5 rounded-full border border-zinc-800 bg-zinc-900 py-1 pl-2.5 pr-1 text-xs text-zinc-300"
        >
          {s.status === "processing" ? (
            <Spinner className="h-3 w-3 shrink-0 text-teal-400" />
          ) : (
            <Icon name={s.type} className="h-3.5 w-3.5 shrink-0 text-zinc-500" />
          )}
          <span className="truncate" title={s.name}>
            {s.name}
          </span>
          <button
            type="button"
            onClick={() => onDetach(s.id)}
            aria-label={`Remove ${s.name} from this chat`}
            className="rounded-full p-0.5 text-zinc-500 transition-colors hover:bg-zinc-800 hover:text-zinc-200"
          >
            <Icon name="close" className="h-3 w-3" />
          </button>
        </span>
      ))}

      <button
        type="button"
        onClick={onOpenPanel}
        className="flex items-center gap-1 rounded-full border border-dashed border-zinc-700 px-2.5 py-1 text-xs text-zinc-400 transition-colors hover:border-teal-700 hover:text-teal-300"
      >
        <Icon name="plus" className="h-3 w-3" />
        Add source
      </button>
    </div>
  );
}
