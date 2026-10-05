"use client";

import { useCallback, useMemo, useState } from "react";

import * as api from "@/lib/chat/api";
import type { Source } from "@/lib/chat/types";
import { errorMessage, uid, youtubeLabel } from "@/lib/chat/utils";

type Options = {
  onUnauthorized: () => void;
  onError: (message: string) => void;
};

export function useSources({ onUnauthorized, onError }: Options) {
  const [sources, setSources] = useState<Source[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const isIndexing = sources.some((s) => s.status === "processing");

  const sourceMap = useMemo(
    () => new Map(sources.map((s) => [s.id, s])),
    [sources],
  );

  const refresh = useCallback(async () => {
    try {
      const list = await api.listSources();
      // Keep in-flight / failed temporary rows; replace everything persisted.
      setSources((prev) => [
        ...prev.filter((s) => s.status !== "ready"),
        ...list,
      ]);
    } catch (err) {
      if (err instanceof api.ApiError && err.status === 401) onUnauthorized();
      else onError(errorMessage(err, "Couldn't load your sources."));
    } finally {
      setLoading(false);
    }
  }, [onUnauthorized, onError]);

  /** Runs an ingestion job with an optimistic "processing" row. Returns the new source id. */
  const ingest = useCallback(
    async (
      type: Source["type"],
      name: string,
      run: () => Promise<{
        sourceId: string;
        chunksIndexed: number;
        fileName?: string;
      }>,
      fallbackError: string,
    ): Promise<string | null> => {
      const tempId = uid();

      setSources((prev) => [
        { id: tempId, type, name, status: "processing" },
        ...prev,
      ]);

      try {
        const result = await run();

        setSources((prev) =>
          prev.map((s) =>
            s.id === tempId
              ? {
                  id: result.sourceId,
                  type,
                  name: result.fileName ?? name,
                  status: "ready",
                  chunks: result.chunksIndexed,
                }
              : s,
          ),
        );

        return result.sourceId;
      } catch (err) {
        if (err instanceof api.ApiError && err.status === 401) {
          setSources((prev) => prev.filter((s) => s.id !== tempId));
          onUnauthorized();
          return null;
        }

        setSources((prev) =>
          prev.map((s) =>
            s.id === tempId
              ? { ...s, status: "error", error: errorMessage(err, fallbackError) }
              : s,
          ),
        );
        return null;
      }
    },
    [onUnauthorized],
  );

  const addYoutube = useCallback(
    (url: string) =>
      ingest(
        "youtube",
        youtubeLabel(url),
        () => api.addYoutubeSource(url),
        "Couldn't add this video.",
      ),
    [ingest],
  );

  const addPdf = useCallback(
    (file: File) =>
      ingest(
        "pdf",
        file.name,
        () => api.addPdfSource(file),
        "Couldn't add this PDF.",
      ),
    [ingest],
  );

  const dismiss = useCallback((id: string) => {
    setSources((prev) => prev.filter((s) => s.id !== id));
  }, []);

  const remove = useCallback(
    async (id: string): Promise<boolean> => {
      setDeletingId(id);
      try {
        await api.deleteSource(id);
        setSources((prev) => prev.filter((s) => s.id !== id));
        return true;
      } catch (err) {
        onError(errorMessage(err, "Failed to delete source."));
        return false;
      } finally {
        setDeletingId(null);
      }
    },
    [onError],
  );

  return {
    sources,
    sourceMap,
    loading,
    isIndexing,
    deletingId,
    refresh,
    addYoutube,
    addPdf,
    dismiss,
    remove,
  };
}
