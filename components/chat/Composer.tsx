"use client";

import {
  useEffect,
  useRef,
  useState,
  type SubmitEvent,
  type KeyboardEvent,
} from "react";

import { Icon, Spinner } from "./icons";

export function Composer({
  disabled,
  sending,
  placeholder,
  onSend,
}: {
  disabled: boolean;
  sending: boolean;
  placeholder: string;
  onSend: (text: string) => void;
}) {
  const [value, setValue] = useState("");
  const ref = useRef<HTMLTextAreaElement>(null);

  // Auto-grow up to 160px.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }, [value]);

  // Focus when the composer becomes usable.
  useEffect(() => {
    if (!disabled) ref.current?.focus();
  }, [disabled]);

  function submit() {
    const text = value.trim();
    if (!text || disabled || sending) return;
    onSend(text);
    setValue("");
  }

  function onSubmit(e: SubmitEvent) {
    e.preventDefault();
    submit();
  }

  function onKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      submit();
    }
  }

  return (
    <div className="px-4 pb-4 pt-2">
      <form onSubmit={onSubmit} className="mx-auto max-w-2xl">
        <div
          className={`flex items-end gap-2 rounded-xl border p-2 transition-colors focus-within:border-teal-600 focus-within:ring-2 focus-within:ring-teal-500/30 ${
            disabled
              ? "border-zinc-800 bg-zinc-950"
              : "border-zinc-700 bg-zinc-900"
          }`}
        >
          <textarea
            ref={ref}
            rows={1}
            value={value}
            disabled={disabled}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder={placeholder}
            aria-label="Message"
            className="max-h-40 flex-1 resize-none bg-transparent px-2 py-1.5 text-sm placeholder:text-zinc-500 focus:outline-none disabled:cursor-not-allowed"
          />

          <button
            type="submit"
            disabled={disabled || sending || !value.trim()}
            aria-label="Send message"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-teal-700 text-white transition-colors hover:bg-teal-600 disabled:cursor-not-allowed disabled:bg-zinc-800 disabled:text-zinc-600"
          >
            {sending ? <Spinner /> : <Icon name="send" className="h-4 w-4" />}
          </button>
        </div>

        <p className="mt-1.5 text-center text-xs text-zinc-600">
          Enter to send · Shift+Enter for a new line
        </p>
      </form>
    </div>
  );
}
