"use client";

import { useState, FormEvent } from "react";

type StatusMsg = { type: "success" | "error"; text: string } | null;

type ChatMessage = { role: "user" | "assistant"; content: string };

export default function Home() {
  // YouTube ingestion state
  const [youtubeUrl, setYoutubeUrl] = useState("");
  const [youtubeLoading, setYoutubeLoading] = useState(false);
  const [youtubeStatus, setYoutubeStatus] = useState<StatusMsg>(null);

  // PDF ingestion state
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [pdfStatus, setPdfStatus] = useState<StatusMsg>(null);

  // Chat state
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);

  async function handleYoutubeSubmit(e: FormEvent) {
    e.preventDefault();
    setYoutubeStatus(null);
    setYoutubeLoading(true);
    try {
      const res = await fetch("/api/sources/youtube", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: youtubeUrl }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to add video.");
      setYoutubeStatus({
        type: "success",
        text: `Indexed ${data.chunksIndexed} chunks from this video.`,
      });
      setYoutubeUrl("");
    } catch (err: any) {
      setYoutubeStatus({ type: "error", text: err.message });
    } finally {
      setYoutubeLoading(false);
    }
  }

  async function handlePdfSubmit(e: FormEvent) {
    e.preventDefault();
    if (!pdfFile) return;
    setPdfStatus(null);
    setPdfLoading(true);
    try {
      const formData = new FormData();
      formData.append("file", pdfFile);
      const res = await fetch("/api/sources/pdf", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to add PDF.");
      setPdfStatus({
        type: "success",
        text: `Indexed ${data.chunksIndexed} chunks from "${data.fileName}".`,
      });
      setPdfFile(null);
    } catch (err: any) {
      setPdfStatus({ type: "error", text: err.message });
    } finally {
      setPdfLoading(false);
    }
  }

  async function handleChatSubmit(e: FormEvent) {
    e.preventDefault();
    if (!chatInput.trim()) return;

    const nextMessages: ChatMessage[] = [
      ...messages,
      { role: "user", content: chatInput },
    ];
    setMessages(nextMessages);
    setChatInput("");
    setChatLoading(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: chatInput, history: nextMessages }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Chat request failed.");
      setMessages([...nextMessages, { role: "assistant", content: data.answer }]);
    } catch (err: any) {
      setMessages([
        ...nextMessages,
        { role: "assistant", content: `Error: ${err.message}` },
      ]);
    } finally {
      setChatLoading(false);
    }
  }

  return (
    <main className="mx-auto max-w-2xl px-6 py-12 space-y-10">
      <header>
        <h1 className="text-2xl font-semibold">RAG Sources</h1>
        <p className="text-sm text-neutral-500 mt-1">
          Add a YouTube link or a PDF, then ask questions about them.
        </p>
      </header>

      {/* YouTube ingestion */}
      <section className="space-y-3">
        <h2 className="font-medium">Add a YouTube link</h2>
        <form onSubmit={handleYoutubeSubmit} className="flex gap-2">
          <input
            type="url"
            required
            placeholder="https://www.youtube.com/watch?v=..."
            value={youtubeUrl}
            onChange={(e) => setYoutubeUrl(e.target.value)}
            className="flex-1 rounded-md border border-neutral-300 px-3 py-2 text-sm"
          />
          <button
            type="submit"
            disabled={youtubeLoading}
            className="rounded-md bg-neutral-900 px-4 py-2 text-sm text-white disabled:opacity-50"
          >
            {youtubeLoading ? "Adding..." : "Add"}
          </button>
        </form>
        {youtubeStatus && (
          <p
            className={
              youtubeStatus.type === "error" ? "text-sm text-red-600" : "text-sm text-green-600"
            }
          >
            {youtubeStatus.text}
          </p>
        )}
      </section>

      {/* PDF ingestion */}
      <section className="space-y-3">
        <h2 className="font-medium">Add a PDF</h2>
        <form onSubmit={handlePdfSubmit} className="flex gap-2">
          <input
            type="file"
            accept="application/pdf"
            required
            onChange={(e) => setPdfFile(e.target.files?.[0] ?? null)}
            className="flex-1 text-sm"
          />
          <button
            type="submit"
            disabled={pdfLoading || !pdfFile}
            className="rounded-md bg-neutral-900 px-4 py-2 text-sm text-white disabled:opacity-50"
          >
            {pdfLoading ? "Adding..." : "Add"}
          </button>
        </form>
        {pdfStatus && (
          <p
            className={
              pdfStatus.type === "error" ? "text-sm text-red-600" : "text-sm text-green-600"
            }
          >
            {pdfStatus.text}
          </p>
        )}
      </section>

      {/* Chat */}
      <section className="space-y-3">
        <h2 className="font-medium">Ask a question</h2>
        <div className="space-y-2 rounded-md border border-neutral-200 p-3 min-h-32 max-h-96 overflow-y-auto">
          {messages.length === 0 && (
            <p className="text-sm text-neutral-400">No messages yet.</p>
          )}
          {messages.map((m, i) => (
            <div key={i} className="text-sm">
              <span className="font-medium">{m.role === "user" ? "You: " : "Assistant: "}</span>
              <span>{m.content}</span>
            </div>
          ))}
        </div>
        <form onSubmit={handleChatSubmit} className="flex gap-2">
          <input
            type="text"
            placeholder="Ask something about your sources..."
            value={chatInput}
            onChange={(e) => setChatInput(e.target.value)}
            className="flex-1 rounded-md border border-neutral-300 px-3 py-2 text-sm"
          />
          <button
            type="submit"
            disabled={chatLoading}
            className="rounded-md bg-neutral-900 px-4 py-2 text-sm text-white disabled:opacity-50"
          >
            {chatLoading ? "..." : "Send"}
          </button>
        </form>
      </section>
    </main>
  );
}
