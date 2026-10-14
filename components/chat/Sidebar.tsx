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
    <div className="flex h-full flex-col bg-[#0D0C09] font-sans">
      <div className="px-3 pb-2 pt-4">
        <p
          className="px-2 pb-3 text-lg text-[#F3F0E8]"
          style={{ fontFamily: "'Source Serif 4', Georgia, serif" }}
        >
          AskSource
        </p>

        <button
          type="button"
          onClick={onNew}
          className={`flex w-full items-center gap-2 border px-3 py-2 text-sm transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#8FAAD1] ${
            isDraft
              ? "border-[#8FAAD1] bg-[#8FAAD1]/10 text-[#8FAAD1]"
              : "border-[#3A372F] text-[#F3F0E8] hover:border-[#F3F0E8] hover:bg-[#F3F0E8] hover:text-[#14130F]"
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
          <div className="flex items-center gap-2 px-2 py-2 text-xs text-[#8F8A7B]">
            <Spinner className="h-3.5 w-3.5" />
            Loading chats…
          </div>
        ) : groups.length === 0 ? (
          <p className="px-2 py-2 text-xs text-[#8F8A7B]">
            No chats yet. Start one above.
          </p>
        ) : (
          groups.map((group) => (
            <section key={group.label} className="mb-4">
              <h3 className="px-2 pb-1 text-[11px] uppercase tracking-wider text-[#5C594C]">
                {group.label}
              </h3>

              <ul className="space-y-0.5">
                {group.items.map((chat) => {
                  const active = chat.id === selectedChatId;

                  return (
                    <li
                      key={chat.id}
                      className={`group flex items-center border-l-2 transition-colors ${
                        active
                          ? "border-[#8FAAD1] bg-[#2A281F]"
                          : "border-transparent hover:bg-[#1A1913]"
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => onSelect(chat.id)}
                        aria-current={active ? "true" : undefined}
                        className={`min-w-0 flex-1 truncate px-3 py-2 text-left text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#8FAAD1] ${
                          active
                            ? "text-[#F3F0E8]"
                            : "text-[#8F8A7B] group-hover:text-[#F3F0E8]"
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

      <div className="flex items-center gap-2 border-t border-[#2A281F] px-3 py-3">
        <p
          className="min-w-0 flex-1 truncate px-2 text-xs text-[#8F8A7B]"
          title={userLabel}
        >
          {userLabel}
        </p>

        <button
          type="button"
          onClick={onSignOut}
          className="flex items-center gap-1.5 px-2 py-1.5 text-xs text-[#8F8A7B] underline decoration-[#3A372F] underline-offset-2 transition-colors hover:text-[#F3F0E8] hover:decoration-[#F3F0E8] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#8FAAD1]"
        >
          <Icon name="logout" className="h-3.5 w-3.5" />
          Sign out
        </button>
      </div>
    </div>
  );
}