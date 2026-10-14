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
    <div className="px-4 pb-4 pt-2 font-sans">
      <form onSubmit={onSubmit} className="mx-auto max-w-2xl">
        <div
          className={`flex items-end gap-2 border p-2 transition-colors focus-within:border-[#8FAAD1] ${
            disabled
              ? "border-[#2A281F] bg-[#14130F]"
              : "border-[#3A372F] bg-[#0D0C09]"
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
            className="max-h-40 flex-1 resize-none bg-transparent px-2 py-1.5 text-[15px] text-[#F3F0E8] placeholder:text-[#5C594C] focus:outline-none disabled:cursor-not-allowed"
          />

          <button
            type="submit"
            disabled={disabled || sending || !value.trim()}
            aria-label="Send message"
            className="flex h-9 w-9 shrink-0 items-center justify-center bg-[#F3F0E8] text-[#14130F] transition-colors hover:bg-[#8FAAD1] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#8FAAD1] disabled:cursor-not-allowed disabled:bg-[#2A281F] disabled:text-[#5C594C]"
          >
            {sending ? <Spinner /> : <Icon name="send" className="h-4 w-4" />}
          </button>
        </div>

        <p className="mt-1.5 text-center text-xs text-[#5C594C]">
          Enter to send · Shift+Enter for a new line
        </p>
      </form>
    </div>
  );
}