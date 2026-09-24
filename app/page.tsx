"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type DragEvent,
  type FormEvent,
  type KeyboardEvent,
} from "react";

/* -------------------------------------------------------------------------- */
/* Types                                                                      */
/* -------------------------------------------------------------------------- */

type SourceStatus = "processing" | "ready" | "error";

type Source = {
  id: string;
  type: "youtube" | "pdf";
  name: string;
  status: SourceStatus;
  chunks?: number;
  error?: string;
};

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  isError?: boolean;
};

// The API is non-streaming, so these phases are a best-effort progression
// shown while we wait for the single response. See ASSISTANT_PHASES below.
type AssistantPhase = "retrieving" | "generating";

/* -------------------------------------------------------------------------- */
/* Constants & helpers                                                        */
/* -------------------------------------------------------------------------- */

const ASSISTANT_PHASES: Record<AssistantPhase, string> = {
  retrieving: "Searching your sources for relevant passages…",
  generating: "Writing an answer…",
};

// How long we show "retrieving" before switching to "generating" (ms).
const RETRIEVAL_PHASE_MS = 1600;

const SUGGESTIONS = [
  "Summarize the main points",
  "What are the key takeaways?",
  "List any important names, dates or numbers",
];

const uid = () => Math.random().toString(36).slice(2, 10);

function errorMessage(err: unknown, fallback: string) {
  return err instanceof Error && err.message ? err.message : fallback;
}

function youtubeLabel(url: string) {
  try {
    const u = new URL(url);
    const id = u.searchParams.get("v") ?? u.pathname.split("/").filter(Boolean).pop();
    return id ? `YouTube · ${id}` : u.hostname;
  } catch {
    return url;
  }
}

/* -------------------------------------------------------------------------- */
/* Small UI pieces                                                            */
/* -------------------------------------------------------------------------- */

function Spinner({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg
      className={`animate-spin ${className}`}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="3" opacity="0.25" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

function Icon({ name, className = "h-4 w-4" }: { name: string; className?: string }) {
  const paths: Record<string, string> = {
    pdf: "M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8l-5-5zM14 3v5h5",
    youtube: "M4 6h16a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1zM10 9.5v5l4.5-2.5-4.5-2.5z",
    check: "M5 12.5l4.5 4.5L19 7.5",
    alert: "M12 8v5m0 3.5h.01M10.3 4.2L2.8 17.5A2 2 0 0 0 4.5 20.5h15a2 2 0 0 0 1.7-3L13.7 4.2a2 2 0 0 0-3.4 0z",
    send: "M5 12h14M13 6l6 6-6 6",
    upload: "M12 16V4m0 0l-4 4m4-4l4 4M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3",
    trash: "M5 7h14M10 7V4h4v3m-7 0l1 13h8l1-13",
    copy: "M9 9h10v11H9zM5 15V4h10",
    menu: "M4 7h16M4 12h16M4 17h16",
    close: "M6 6l12 12M18 6L6 18",
  };
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={paths[name]} />
    </svg>
  );
}

function TypingDots() {
  return (
    <span className="inline-flex items-center gap-1" aria-hidden="true">
      {[0, 150, 300].map((d) => (
        <span
          key={d}
          className="h-1.5 w-1.5 animate-bounce rounded-full bg-teal-400/70"
          style={{ animationDelay: `${d}ms` }}
        />
      ))}
    </span>
  );
}

function SourceRow({ source }: { source: Source }) {
  return (
    <li className="rounded-lg border border-zinc-800 bg-zinc-900 p-3">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 text-zinc-400">
          <Icon name={source.type} className="h-5 w-5" />
        </span>

        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-zinc-200" title={source.name}>
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

          {source.status === "ready" && (
            <p className="mt-0.5 flex items-center gap-1.5 text-xs text-zinc-400">
              <span className="text-teal-400">
                <Icon name="check" className="h-3.5 w-3.5" />
              </span>
              Ready · {source.chunks} chunks indexed
            </p>
          )}

          {source.status === "error" && (
            <p className="mt-0.5 flex items-start gap-1.5 text-xs text-red-400">
              <span className="mt-px shrink-0">
                <Icon name="alert" className="h-3.5 w-3.5" />
              </span>
              {source.error}
            </p>
          )}
        </div>
      </div>

      {source.status === "processing" && (
        <div className="mt-3 h-1 overflow-hidden rounded-full bg-zinc-800">
          <div className="h-full w-1/3 animate-[slide_1.2s_ease-in-out_infinite] rounded-full bg-teal-600" />
        </div>
      )}
    </li>
  );
}

/* -------------------------------------------------------------------------- */
/* Page                                                                       */
/* -------------------------------------------------------------------------- */

export default function Home() {
  // Sources
  const [sources, setSources] = useState<Source[]>([]);
  const [youtubeUrl, setYoutubeUrl] = useState("");
  const [dragging, setDragging] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Chat
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [phase, setPhase] = useState<AssistantPhase | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const chatLoading = phase !== null;
  const readyCount = sources.filter((s) => s.status === "ready").length;
  const processingCount = sources.filter((s) => s.status === "processing").length;
  const canChat = readyCount > 0;

  // Keep the newest message / loading indicator in view.
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, phase]);

  const updateSource = useCallback((id: string, patch: Partial<Source>) => {
    setSources((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  }, []);

  /* ------------------------------ Ingestion ------------------------------ */

  async function addYoutube(e: FormEvent) {
    e.preventDefault();
    const url = youtubeUrl.trim();
    if (!url) return;

    const id = uid();
    setSources((prev) => [
      { id, type: "youtube", name: youtubeLabel(url), status: "processing" },
      ...prev,
    ]);
    setYoutubeUrl("");

    try {
      const res = await fetch("/api/sources/youtube", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Couldn't add this video.");
      updateSource(id, { status: "ready", chunks: data.chunksIndexed });
    } catch (err) {
      updateSource(id, {
        status: "error",
        error: errorMessage(err, "Couldn't add this video."),
      });
    }
  }

  async function addPdf(file: File) {
    if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
      setSources((prev) => [
        {
          id: uid(),
          type: "pdf",
          name: file.name,
          status: "error",
          error: "Only PDF files are supported.",
        },
        ...prev,
      ]);
      return;
    }

    const id = uid();
    setSources((prev) => [
      { id, type: "pdf", name: file.name, status: "processing" },
      ...prev,
    ]);

    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/sources/pdf", { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Couldn't add this PDF.");
      updateSource(id, {
        status: "ready",
        chunks: data.chunksIndexed,
        name: data.fileName ?? file.name,
      });
    } catch (err) {
      updateSource(id, {
        status: "error",
        error: errorMessage(err, "Couldn't add this PDF."),
      });
    }
  }

  function handleFiles(files: FileList | null) {
    if (!files) return;
    Array.from(files).forEach(addPdf);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function onDrop(e: DragEvent) {
    e.preventDefault();
    setDragging(false);
    handleFiles(e.dataTransfer.files);
  }

  /* ------------------------------- Chat ---------------------------------- */

  async function sendMessage(text: string) {
    const message = text.trim();
    if (!message || chatLoading || !canChat) return;

    // History sent to the API = everything before this question, minus errors.
    const history = messages
      .filter((m) => !m.isError)
      .map(({ role, content }) => ({ role, content }));

    setMessages((prev) => [...prev, { id: uid(), role: "user", content: message }]);
    setInput("");
    if (textareaRef.current) textareaRef.current.style.height = "auto";

    setPhase("retrieving");
    const phaseTimer = window.setTimeout(() => setPhase("generating"), RETRIEVAL_PHASE_MS);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message, history }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Something went wrong.");
      setMessages((prev) => [...prev, { id: uid(), role: "assistant", content: data.answer }]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          id: uid(),
          role: "assistant",
          content: errorMessage(err, "Something went wrong. Please try again."),
          isError: true,
        },
      ]);
    } finally {
      window.clearTimeout(phaseTimer);
      setPhase(null);
    }
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    sendMessage(input);
  }

  function onKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      sendMessage(input);
    }
  }

  function autoGrow(el: HTMLTextAreaElement) {
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }

  async function copy(m: ChatMessage) {
    try {
      await navigator.clipboard.writeText(m.content);
      setCopiedId(m.id);
      window.setTimeout(() => setCopiedId(null), 1500);
    } catch {
      /* clipboard unavailable — ignore */
    }
  }

  /* ------------------------------- Render -------------------------------- */

  const sidebar = (
    <div className="flex h-full flex-col gap-5 overflow-y-auto p-5">
      <div>
        <h2 className="text-sm font-semibold text-zinc-100">Sources</h2>
        <p className="mt-1 text-xs leading-relaxed text-zinc-400">
          Answers come only from what you add here.
        </p>
      </div>

      {/* PDF drop zone */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        className={`rounded-lg border border-dashed p-4 text-center transition-colors ${
          dragging ? "border-teal-600 bg-teal-950/40" : "border-zinc-700 bg-zinc-900"
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="application/pdf"
          multiple
          className="sr-only"
          id="pdf-input"
          onChange={(e) => handleFiles(e.target.files)}
        />
        <span className="mx-auto mb-2 block w-fit text-zinc-500">
          <Icon name="upload" className="h-6 w-6" />
        </span>
        <label
          htmlFor="pdf-input"
          className="cursor-pointer text-sm font-medium text-teal-400 hover:underline focus-within:underline"
        >
          Choose a PDF
        </label>
        <p className="mt-1 text-xs text-zinc-400">or drag and drop it here</p>
      </div>

      {/* YouTube form */}
      <form onSubmit={addYoutube} className="space-y-2">
        <label htmlFor="yt-url" className="text-sm font-medium text-zinc-200">
          YouTube link
        </label>
        <div className="flex gap-2">
          <input
            id="yt-url"
            type="url"
            required
            placeholder="https://youtube.com/watch?v=…"
            value={youtubeUrl}
            onChange={(e) => setYoutubeUrl(e.target.value)}
            className="min-w-0 flex-1 rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm placeholder:text-zinc-500 focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-500/30"
          />
          <button
            type="submit"
            className="rounded-md bg-zinc-100 px-3 py-2 text-sm font-medium text-zinc-900 transition-colors hover:bg-zinc-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-100"
          >
            Add
          </button>
        </div>
      </form>

      {/* Source list */}
      {sources.length > 0 ? (
        <ul className="space-y-2">
          {sources.map((s) => (
            <SourceRow key={s.id} source={s} />
          ))}
        </ul>
      ) : (
        <p className="text-xs text-zinc-400">No sources yet. Add a PDF or a video to get started.</p>
      )}
    </div>
  );

  return (
    <div className="flex h-dvh bg-zinc-950 text-zinc-100 [color-scheme:dark]">
      {/* Keyframes for the indeterminate progress bar */}
      <style>{`@keyframes slide { 0% { transform: translateX(-100%); } 100% { transform: translateX(300%); } }
        @media (prefers-reduced-motion: reduce) { .animate-spin, .animate-bounce, [class*="animate-["] { animation: none !important; } }`}</style>

      {/* Desktop sidebar */}
      <aside className="hidden w-80 shrink-0 border-r border-zinc-800 bg-zinc-950 md:block">
        {sidebar}
      </aside>

      {/* Mobile drawer */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div className="absolute inset-0 bg-black/60" onClick={() => setSidebarOpen(false)} />
          <aside className="absolute inset-y-0 left-0 w-[85%] max-w-sm bg-zinc-950 shadow-xl">
            <button
              onClick={() => setSidebarOpen(false)}
              className="absolute right-3 top-3 rounded-md p-1.5 text-zinc-400 hover:bg-zinc-800"
              aria-label="Close sources"
            >
              <Icon name="close" className="h-5 w-5" />
            </button>
            {sidebar}
          </aside>
        </div>
      )}

      {/* Chat column */}
      <main className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center gap-3 border-b border-zinc-800 bg-zinc-950 px-4 py-3">
          <button
            onClick={() => setSidebarOpen(true)}
            className="rounded-md p-1.5 text-zinc-400 hover:bg-zinc-800 md:hidden"
            aria-label="Open sources"
          >
            <Icon name="menu" className="h-5 w-5" />
          </button>

          <div className="min-w-0 flex-1">
            <h1 className="text-sm font-semibold">Ask your sources</h1>
            <p className="truncate text-xs text-zinc-400" aria-live="polite">
              {processingCount > 0
                ? `Embedding ${processingCount} source${processingCount > 1 ? "s" : ""}…`
                : readyCount > 0
                  ? `${readyCount} source${readyCount > 1 ? "s" : ""} ready`
                  : "Add a source to begin"}
            </p>
          </div>

          {messages.length > 0 && (
            <button
              onClick={() => setMessages([])}
              disabled={chatLoading}
              className="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs text-zinc-400 hover:bg-zinc-800 disabled:opacity-50"
            >
              <Icon name="trash" className="h-3.5 w-3.5" />
              Clear chat
            </button>
          )}
        </header>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 py-6">
          <div className="mx-auto max-w-2xl space-y-6">
            {messages.length === 0 && (
              <div className="pt-10 text-center">
                <h2 className="text-lg font-semibold">
                  {canChat ? "What would you like to know?" : "Start by adding a source"}
                </h2>
                <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-zinc-400">
                  {canChat
                    ? "Ask a question and I'll answer from your PDFs and videos."
                    : processingCount > 0
                      ? "Your source is being embedded. You can start asking questions as soon as it's ready."
                      : "Upload a PDF or paste a YouTube link in the Sources panel, then ask questions about it here."}
                </p>

                {canChat && (
                  <div className="mt-5 flex flex-wrap justify-center gap-2">
                    {SUGGESTIONS.map((s) => (
                      <button
                        key={s}
                        onClick={() => sendMessage(s)}
                        className="rounded-full border border-zinc-700 bg-zinc-900 px-3.5 py-1.5 text-sm text-zinc-300 transition-colors hover:border-teal-600 hover:text-teal-300"
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                )}

                {!canChat && processingCount > 0 && (
                  <div className="mt-5 flex justify-center text-teal-400">
                    <Spinner className="h-5 w-5" />
                  </div>
                )}
              </div>
            )}

            {messages.map((m) =>
              m.role === "user" ? (
                <div key={m.id} className="flex justify-end">
                  <div className="max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-br-md bg-zinc-800 px-4 py-2.5 text-sm leading-relaxed text-zinc-100">
                    {m.content}
                  </div>
                </div>
              ) : (
                <div key={m.id} className="group flex gap-3">
                  <div
                    className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
                      m.isError ? "bg-red-950 text-red-400" : "bg-teal-700 text-white"
                    }`}
                    aria-hidden="true"
                  >
                    {m.isError ? "!" : "AI"}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div
                      className={`whitespace-pre-wrap text-sm leading-relaxed ${
                        m.isError ? "text-red-400" : "text-zinc-200"
                      }`}
                    >
                      {m.content}
                    </div>
                    {!m.isError && (
                      <button
                        onClick={() => copy(m)}
                        className="mt-1.5 flex items-center gap-1 text-xs text-zinc-500 opacity-0 transition-opacity hover:text-zinc-300 focus:opacity-100 group-hover:opacity-100"
                      >
                        <Icon name="copy" className="h-3.5 w-3.5" />
                        {copiedId === m.id ? "Copied" : "Copy"}
                      </button>
                    )}
                  </div>
                </div>
              ),
            )}

            {/* Live status while waiting on the API */}
            {phase && (
              <div className="flex gap-3" role="status" aria-live="polite">
                <div
                  className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-teal-700 text-xs font-semibold text-white"
                  aria-hidden="true"
                >
                  AI
                </div>
                <div className="flex items-center gap-2.5 pt-1 text-sm text-zinc-400">
                  <TypingDots />
                  <span>{ASSISTANT_PHASES[phase]}</span>
                </div>
              </div>
            )}

            <div ref={bottomRef} />
          </div>
        </div>

        {/* Composer */}
        <div className="border-t border-zinc-800 bg-zinc-950 px-4 py-3">
          <form onSubmit={onSubmit} className="mx-auto max-w-2xl">
            <div
              className={`flex items-end gap-2 rounded-xl border bg-zinc-900 p-2 transition-colors focus-within:border-teal-600 focus-within:ring-2 focus-within:ring-teal-500/30 ${
                canChat ? "border-zinc-700" : "border-zinc-800 bg-zinc-950"
              }`}
            >
              <textarea
                ref={textareaRef}
                rows={1}
                value={input}
                disabled={!canChat}
                onChange={(e) => {
                  setInput(e.target.value);
                  autoGrow(e.target);
                }}
                onKeyDown={onKeyDown}
                placeholder={
                  canChat
                    ? "Ask something about your sources…"
                    : processingCount > 0
                      ? "Waiting for your source to finish embedding…"
                      : "Add a source to start chatting"
                }
                className="max-h-40 flex-1 resize-none bg-transparent px-2 py-1.5 text-sm placeholder:text-zinc-500 focus:outline-none disabled:cursor-not-allowed"
              />
              <button
                type="submit"
                disabled={!canChat || chatLoading || !input.trim()}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-teal-700 text-white transition-colors hover:bg-teal-600 disabled:cursor-not-allowed disabled:bg-zinc-800 disabled:text-zinc-600"
                aria-label="Send message"
              >
                {chatLoading ? <Spinner /> : <Icon name="send" className="h-4 w-4" />}
              </button>
            </div>
            <p className="mt-1.5 text-center text-xs text-zinc-500">
              Enter to send · Shift+Enter for a new line
            </p>
          </form>
        </div>
      </main>
    </div>
  );
}