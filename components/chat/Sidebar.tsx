"use client";

import { useMemo } from "react";

import type { Chat } from "@/lib/chat/types";
import { groupChatsByDate } from "@/lib/chat/utils";

import { ConfirmDelete } from "./ConfirmDelete";
import { Icon, Spinner } from "./icons";

type Props = {
  chats: Chat[];
  loading: boolean;
  selectedChatId: string | null;
  isDraft: boolean;
  deletingId: string | null;
  userLabel?: string;
  onNew: () => void;
  onSelect: (chatId: string) => void;
  onDelete: (chatId: string) => void;
  onSignOut: () => void;
};

export function Sidebar({
  chats,
  loading,
  selectedChatId,
  isDraft,
  deletingId,
  userLabel,
  onNew,
  onSelect,
  onDelete,
  onSignOut,
}: Props) {
  const groups = useMemo(() => groupChatsByDate(chats), [chats]);

  return (
    <div className="flex h-full flex-col bg-zinc-950">
      <div className="px-3 pb-2 pt-4">
        <p className="px-2 pb-3 text-sm font-semibold tracking-tight text-zinc-100">
          Ask your sources
        </p>

        <button
          type="button"
          onClick={onNew}
          className={`flex w-full items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
            isDraft
              ? "border-teal-700/60 bg-teal-950/40 text-teal-200"
              : "border-zinc-800 text-zinc-300 hover:border-zinc-700 hover:bg-zinc-900"
          }`}
        >
          <Icon name="plus" className="h-4 w-4" />
          New chat
        </button>
      </div>

      <nav
        aria-label="Chat history"
        className="flex-1 overflow-y-auto px-3 pb-3 pt-2"
      >
        {loading ? (
          <div className="flex items-center gap-2 px-2 py-2 text-xs text-zinc-500">
            <Spinner className="h-3.5 w-3.5" />
            Loading chats…
          </div>
        ) : groups.length === 0 ? (
          <p className="px-2 py-2 text-xs text-zinc-500">
            No chats yet. Start one above.
          </p>
        ) : (
          groups.map((group) => (
            <section key={group.label} className="mb-4">
              <h3 className="px-2 pb-1 text-[11px] font-medium uppercase tracking-wider text-zinc-500">
                {group.label}
              </h3>

              <ul className="space-y-0.5">
                {group.items.map((chat) => {
                  const active = chat.id === selectedChatId;

                  return (
                    <li
                      key={chat.id}
                      className={`group flex items-center rounded-lg transition-colors ${
                        active ? "bg-zinc-800/80" : "hover:bg-zinc-900"
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => onSelect(chat.id)}
                        aria-current={active ? "true" : undefined}
                        className={`min-w-0 flex-1 truncate px-3 py-2 text-left text-sm ${
                          active ? "text-zinc-100" : "text-zinc-400 group-hover:text-zinc-200"
                        }`}
                        title={chat.title}
                      >
                        {chat.title || "Untitled chat"}
                      </button>

                      <div className="pr-1.5">
                        <ConfirmDelete
                          label="Delete chat"
                          revealOnHover
                          busy={deletingId === chat.id}
                          onConfirm={() => onDelete(chat.id)}
                        />
                      </div>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))
        )}
      </nav>

      <div className="flex items-center gap-2 border-t border-zinc-800/70 px-3 py-3">
        <p
          className="min-w-0 flex-1 truncate px-2 text-xs text-zinc-500"
          title={userLabel}
        >
          {userLabel}
        </p>

        <button
          type="button"
          onClick={onSignOut}
          className="flex items-center gap-1.5 rounded-md px-2 py-1.5 text-xs text-zinc-400 transition-colors hover:bg-zinc-900 hover:text-zinc-200"
        >
          <Icon name="logout" className="h-3.5 w-3.5" />
          Sign out
        </button>
      </div>
    </div>
  );
}
