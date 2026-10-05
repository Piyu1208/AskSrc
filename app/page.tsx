"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type DragEvent,
} from "react";
import { useRouter } from "next/navigation";

import { useSession } from "@/lib/auth-client";

import { Composer } from "@/components/chat/Composer";
import { MessageList } from "@/components/chat/MessageList";
import { Sidebar } from "@/components/chat/Sidebar";
import { SourceChips } from "@/components/chat/SourceChips";
import { SourcesPanel } from "@/components/chat/SourcesPanel";
import { Toast } from "@/components/chat/Toast";
import { Icon, Spinner } from "@/components/chat/icons";
import { useChats } from "@/hooks/useChats";
import { useSources } from "@/hooks/useSources";
import { useToast } from "@/hooks/useToast";
import { SOURCE_DRAG_TYPE, isPdf } from "@/lib/chat/utils";

type DragKind = "file" | "source" | null;

function dragKindOf(e: DragEvent): DragKind {
  const types = Array.from(e.dataTransfer.types);
  if (types.includes(SOURCE_DRAG_TYPE)) return "source";
  if (types.includes("Files")) return "file";
  return null;
}

export default function Home() {
  const { data: session, isPending: sessionLoading } = useSession();
  const router = useRouter();
  const toast = useToast();
  const { show: showToast } = toast;

  const onUnauthorized = useCallback(() => router.replace("/auth"), [router]);

  const {
    sources,
    sourceMap,
    loading: sourcesLoading,
    isIndexing,
    deletingId: deletingSourceId,
    refresh: refreshSources,
    addYoutube,
    addPdf,
    dismiss: dismissSource,
    remove: removeSource,
  } = useSources({ onUnauthorized, onError: showToast });

  const {
    chats,
    loading: chatsLoading,
    selectedChatId,
    selectedChat,
    isDraft,
    attachedIds,
    messages,
    messagesLoading,
    sending,
    phase,
    deletingId: deletingChatId,
    refresh: refreshChats,
    startDraft,
    select,
    remove: removeChat,
    attach,
    detach,
    forgetSource,
    send,
  } = useChats({ onUnauthorized, onError: showToast });

  const [panelOpen, setPanelOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [dragKind, setDragKind] = useState<DragKind>(null);
  const dragDepth = useRef(0);

  /* ------------------------------ Initial load ------------------------------ */

  useEffect(() => {
    if (sessionLoading) return;

    if (!session) {
      router.replace("/auth");
      return;
    }

    void refreshSources();
    void refreshChats();
  }, [session, sessionLoading, router, refreshSources, refreshChats]);

  /* ------------------------------ Derived state ----------------------------- */

  const attachedSources = attachedIds
    .map((id) => sourceMap.get(id))
    .filter((s): s is NonNullable<typeof s> => Boolean(s));

  const readyAttached = attachedSources.filter((s) => s.status === "ready");
  const canChat = readyAttached.length > 0;
  const processingAttached = attachedSources.some(
    (s) => s.status === "processing",
  );

  const placeholder = canChat
    ? readyAttached.length === 1
      ? `Ask something about ${readyAttached[0].name}…`
      : `Ask something across ${readyAttached.length} sources…`
    : processingAttached
      ? "Waiting for your source to finish embedding…"
      : "Add a source to start chatting";

  /* -------------------------------- Handlers -------------------------------- */

  const handleFiles = useCallback(
    async (files: File[]) => {
      const pdfs = files.filter(isPdf);

      if (pdfs.length !== files.length) {
        showToast("Only PDF files are supported.");
      }
      if (pdfs.length === 0) return;

      if (isIndexing) {
        showToast("Please wait for the current source to finish indexing.");
        return;
      }

      // Index one at a time, attaching each to the current chat as it finishes.
      for (const file of pdfs) {
        const id = await addPdf(file);
        if (id) await attach(id);
      }
    },
    [isIndexing, addPdf, attach, showToast],
  );

  const handleYoutube = useCallback(
    async (url: string) => {
      const id = await addYoutube(url);
      if (id) await attach(id);
    },
    [addYoutube, attach],
  );

  const handleDeleteSource = useCallback(
    async (id: string) => {
      if (await removeSource(id)) forgetSource(id);
    },
    [removeSource, forgetSource],
  );

  const handleSignOut = useCallback(async () => {
    router.replace("/auth");
    return;
  }, []);

  const handleNewChat = useCallback(() => {
    startDraft();
    setSidebarOpen(false);
  }, [startDraft]);

  const handleSelectChat = useCallback(
    async (id: string) => {
      setSidebarOpen(false);
      await select(id);
    },
    [select],
  );

  /* ---------------------- Drag & drop onto the chat area --------------------- */

  function onDragEnter(e: DragEvent) {
    const kind = dragKindOf(e);
    if (!kind) return;
    e.preventDefault();
    dragDepth.current += 1;
    setDragKind(kind);
  }

  function onDragOver(e: DragEvent) {
    if (!dragKindOf(e)) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
  }

  function onDragLeave(e: DragEvent) {
    if (!dragKindOf(e)) return;
    dragDepth.current = Math.max(0, dragDepth.current - 1);
    if (dragDepth.current === 0) setDragKind(null);
  }

  function onDrop(e: DragEvent) {
    const kind = dragKindOf(e);
    if (!kind) return;
    e.preventDefault();
    dragDepth.current = 0;
    setDragKind(null);

    if (kind === "source") {
      const id = e.dataTransfer.getData(SOURCE_DRAG_TYPE);
      if (id && sourceMap.get(id)?.status === "ready") void attach(id);
    } else {
      void handleFiles(Array.from(e.dataTransfer.files));
    }
  }

  /* ---------------------------------- Render --------------------------------- */

  if (sessionLoading || !session) {
    return (
      <div className="flex h-dvh items-center justify-center bg-zinc-950 text-zinc-500 [color-scheme:dark]">
        <Spinner className="h-5 w-5" />
      </div>
    );
  }

  const sidebar = (
    <Sidebar
      chats={chats}
      loading={chatsLoading}
      selectedChatId={selectedChatId}
      isDraft={isDraft}
      deletingId={deletingChatId}
      userLabel={session.user?.name || session.user?.email}
      onNew={handleNewChat}
      onSelect={handleSelectChat}
      onDelete={removeChat}
      onSignOut={handleSignOut}
    />
  );

  return (
    <div className="flex h-dvh bg-zinc-950 text-zinc-100 [color-scheme:dark]">
      {/* Desktop sidebar */}
      <aside className="hidden w-64 shrink-0 border-r border-zinc-800/70 md:block">
        {sidebar}
      </aside>

      {/* Mobile sidebar drawer */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div
            className="absolute inset-0 bg-black/60"
            onClick={() => setSidebarOpen(false)}
          />
          <aside className="absolute inset-y-0 left-0 w-[80%] max-w-xs border-r border-zinc-800 shadow-xl">
            {sidebar}
          </aside>
        </div>
      )}

      {/* Chat column (also the drop target) */}
      <main
        className="relative flex min-w-0 flex-1 flex-col"
        onDragEnter={onDragEnter}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
      >
        <header className="flex items-center gap-2 border-b border-zinc-800/70 px-4 py-3">
          <button
            type="button"
            onClick={() => setSidebarOpen(true)}
            className="rounded-md p-1.5 text-zinc-400 transition-colors hover:bg-zinc-800 md:hidden"
            aria-label="Open chat history"
          >
            <Icon name="menu" className="h-5 w-5" />
          </button>

          <h1 className="min-w-0 flex-1 truncate text-sm font-semibold">
            {selectedChat?.title || "New chat"}
          </h1>

          <button
            type="button"
            onClick={() => setPanelOpen((v) => !v)}
            aria-pressed={panelOpen}
            className={`flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs transition-colors ${panelOpen
                ? "border-teal-700/60 bg-teal-950/40 text-teal-200"
                : "border-zinc-800 text-zinc-300 hover:border-zinc-700 hover:bg-zinc-900"
              }`}
          >
            <Icon name="panel" className="h-3.5 w-3.5" />
            Sources
            {sources.length > 0 && (
              <span className="rounded bg-zinc-800 px-1 text-[10px] text-zinc-400">
                {sources.length}
              </span>
            )}
          </button>
        </header>

        <div className="border-b border-zinc-800/70 px-4 py-2.5">
          <SourceChips
            sources={attachedSources}
            onDetach={(id) => void detach(id)}
            onOpenPanel={() => setPanelOpen(true)}
          />
        </div>

        <MessageList
          messages={messages}
          loading={messagesLoading}
          phase={phase}
          sourceMap={sourceMap}
          attachedCount={attachedSources.length}
          canChat={canChat}
          processing={processingAttached}
          onSuggestion={(text) => void send(text)}
          onOpenPanel={() => setPanelOpen(true)}
        />

        <Composer
          disabled={!canChat}
          sending={sending}
          placeholder={placeholder}
          onSend={(text) => void send(text)}
        />

        {dragKind && (
          <div
            className="pointer-events-none absolute inset-2 z-30 flex items-center justify-center rounded-xl border-2 border-dashed border-teal-600/70 bg-zinc-950/85"
            aria-hidden="true"
          >
            <div className="text-center">
              <Icon
                name={dragKind === "file" ? "upload" : "plus"}
                className="mx-auto mb-2 h-6 w-6 text-teal-400"
              />
              <p className="text-sm font-medium text-teal-200">
                {dragKind === "file"
                  ? "Drop PDFs to add them to this chat"
                  : "Drop to add this source to the chat"}
              </p>
            </div>
          </div>
        )}
      </main>

      {panelOpen && (
        <SourcesPanel
          sources={sources}
          loading={sourcesLoading}
          attachedIds={attachedIds}
          isIndexing={isIndexing}
          deletingId={deletingSourceId}
          onClose={() => setPanelOpen(false)}
          onAttach={(id) => void attach(id)}
          onDetach={(id) => void detach(id)}
          onDelete={(id) => void handleDeleteSource(id)}
          onDismiss={dismissSource}
          onAddYoutube={(url) => void handleYoutube(url)}
          onFiles={(files) => void handleFiles(files)}
        />
      )}

      <Toast message={toast.message} onDismiss={toast.dismiss} />
    </div>
  );
}
