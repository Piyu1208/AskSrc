"use client";

import { useCallback, useRef, useState } from "react";

import * as api from "@/lib/chat/api";
import type { AssistantPhase, Chat, ChatMessage } from "@/lib/chat/types";
import { RETRIEVAL_PHASE_MS, errorMessage } from "@/lib/chat/utils";

type Options = {
  onUnauthorized: () => void;
  onError: (message: string) => void;
};

/**
 * Owns the chat list, the selected chat, its messages and the sources attached to it.
 *
 * "New chat" is a local draft: nothing is created on the server until the first
 * message is sent, so the sidebar never fills up with empty chats. Sources can be
 * attached to the draft before that.
 */
export function useChats({ onUnauthorized, onError }: Options) {
  const [chats, setChats] = useState<Chat[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedChatId, setSelectedChatId] = useState<string | null>(null);
  const [draftSourceIds, setDraftSourceIds] = useState<string[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [phase, setPhase] = useState<AssistantPhase | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Refs mirror state so async flows never act on stale values.
  const activeIdRef = useRef<string | null>(null);
  const chatsRef = useRef<Chat[]>([]);

  const commit = useCallback((next: Chat[]) => {
    chatsRef.current = next;
    setChats(next);
  }, []);

  const handleError = useCallback(
    (err: unknown, fallback: string) => {
      if (err instanceof api.ApiError && err.status === 401) onUnauthorized();
      else onError(errorMessage(err, fallback));
    },
    [onUnauthorized, onError],
  );

  const selectedChat = chats.find((c) => c.id === selectedChatId) ?? null;
  const attachedIds = selectedChat ? selectedChat.sourceIds : draftSourceIds;

  /* ------------------------------ Chat list ------------------------------ */

  const refresh = useCallback(async () => {
    try {
      commit(await api.listChats());
    } catch (err) {
      handleError(err, "Couldn't load your chats.");
    } finally {
      setLoading(false);
    }
  }, [commit, handleError]);

  const startDraft = useCallback(() => {
    activeIdRef.current = null;
    setSelectedChatId(null);
    setDraftSourceIds([]);
    setMessages([]);
    setMessagesLoading(false);
  }, []);

  const select = useCallback(
    async (chatId: string) => {
      if (activeIdRef.current === chatId) return;

      activeIdRef.current = chatId;
      setSelectedChatId(chatId);
      setMessages([]);
      setMessagesLoading(true);

      try {
        const loaded = await api.getChatMessages(chatId);
        if (activeIdRef.current === chatId) setMessages(loaded);
      } catch (err) {
        if (activeIdRef.current === chatId) handleError(err, "Failed to open chat.");
      } finally {
        if (activeIdRef.current === chatId) setMessagesLoading(false);
      }
    },
    [handleError],
  );

  const remove = useCallback(
    async (chatId: string) => {
      setDeletingId(chatId);
      try {
        await api.deleteChat(chatId);
        commit(chatsRef.current.filter((c) => c.id !== chatId));
        if (activeIdRef.current === chatId) startDraft();
      } catch (err) {
        handleError(err, "Failed to delete chat.");
      } finally {
        setDeletingId(null);
      }
    },
    [commit, startDraft, handleError],
  );

  /* ------------------------- Attached sources ---------------------------- */

  const updateAttached = useCallback(
    async (updater: (current: string[]) => string[]) => {
      const chatId = activeIdRef.current;

      if (!chatId) {
        setDraftSourceIds(updater);
        return;
      }

      const current =
        chatsRef.current.find((c) => c.id === chatId)?.sourceIds ?? [];
      const next = updater(current);

      if (
        next.length === current.length &&
        next.every((id, i) => id === current[i])
      ) {
        return;
      }

      const patch = (ids: string[]) =>
        commit(
          chatsRef.current.map((c) =>
            c.id === chatId ? { ...c, sourceIds: ids } : c,
          ),
        );

      patch(next); // optimistic

      try {
        await api.updateChatSources(chatId, next);
      } catch (err) {
        patch(current); // roll back
        handleError(err, "Couldn't update this chat's sources.");
      }
    },
    [commit, handleError],
  );

  const attach = useCallback(
    (sourceId: string) =>
      updateAttached((cur) => (cur.includes(sourceId) ? cur : [...cur, sourceId])),
    [updateAttached],
  );

  const detach = useCallback(
    (sourceId: string) =>
      updateAttached((cur) => cur.filter((id) => id !== sourceId)),
    [updateAttached],
  );

  /** Called after a source is deleted so no chat keeps pointing at it. */
  const forgetSource = useCallback(
    (sourceId: string) => {
      setDraftSourceIds((cur) => cur.filter((id) => id !== sourceId));
      commit(
        chatsRef.current.map((c) =>
          c.sourceIds.includes(sourceId)
            ? { ...c, sourceIds: c.sourceIds.filter((id) => id !== sourceId) }
            : c,
        ),
      );
    },
    [commit],
  );

  /* ------------------------------ Messaging ------------------------------ */

  const send = useCallback(
    async (text: string) => {
      const content = text.trim();
      if (!content || sending) return;

      setSending(true);

      const tempId = crypto.randomUUID();
      setMessages((prev) => [...prev, { id: tempId, role: "user", content }]);

      setPhase("retrieving");
      const phaseTimer = window.setTimeout(
        () => setPhase("generating"),
        RETRIEVAL_PHASE_MS,
      );

      let chatId = activeIdRef.current;

      try {
        // First message of a draft: create the chat and attach its sources.
        if (!chatId) {
          const created = await api.createChat(content.slice(0, 50));
          await api.updateChatSources(created.id, draftSourceIds);

          chatId = created.id;
          activeIdRef.current = created.id;

          commit([
            { ...created, sourceIds: draftSourceIds },
            ...chatsRef.current,
          ]);
          setSelectedChatId(created.id);
          setDraftSourceIds([]);
        }

        const { user, assistant } = await api.sendChatMessage(chatId, content);

        if (activeIdRef.current === chatId) {
          setMessages((prev) => [
            ...prev.filter((m) => m.id !== tempId),
            user,
            assistant,
          ]);
        }

        void refresh(); // pick up updated ordering / title
      } catch (err) {
        if (err instanceof api.ApiError && err.status === 401) {
          onUnauthorized();
        } else if (activeIdRef.current === chatId) {
          setMessages((prev) => [
            ...prev,
            {
              id: crypto.randomUUID(),
              role: "assistant",
              content: errorMessage(err, "Something went wrong."),
              isError: true,
            },
          ]);
        }
      } finally {
        window.clearTimeout(phaseTimer);
        setPhase(null);
        setSending(false);
      }
    },
    [sending, draftSourceIds, commit, refresh, onUnauthorized],
  );

  return {
    chats,
    loading,
    selectedChatId,
    selectedChat,
    isDraft: selectedChatId === null,
    attachedIds,
    messages,
    messagesLoading,
    sending,
    phase,
    deletingId,
    refresh,
    startDraft,
    select,
    remove,
    attach,
    detach,
    forgetSource,
    send,
  };
}
