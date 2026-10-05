"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export function useToast(duration = 5000) {
  const [message, setMessage] = useState<string | null>(null);
  const timer = useRef<number | undefined>(undefined);

  const dismiss = useCallback(() => {
    window.clearTimeout(timer.current);
    setMessage(null);
  }, []);

  const show = useCallback(
    (text: string) => {
      window.clearTimeout(timer.current);
      setMessage(text);
      timer.current = window.setTimeout(() => setMessage(null), duration);
    },
    [duration],
  );

  useEffect(() => () => window.clearTimeout(timer.current), []);

  return { message, show, dismiss };
}
