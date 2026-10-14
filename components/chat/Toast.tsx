"use client";

import { Icon } from "./icons";

export function Toast({
  message,
  onDismiss,
}: {
  message: string | null;
  onDismiss: () => void;
}) {
  if (!message) return null;

  return (
    <div
      role="alert"
      className="fixed bottom-24 left-1/2 z-50 flex max-w-[90vw] -translate-x-1/2 items-center gap-3 border border-[#3A372F] border-l-2 border-l-[#E2725B] bg-[#0D0C09] px-4 py-2.5 font-sans text-sm text-[#F3F0E8] shadow-lg"
    >
      <Icon name="alert" className="h-4 w-4 shrink-0 text-[#E2725B]" />
      <span>{message}</span>
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Dismiss"
        className="p-0.5 text-[#8F8A7B] transition-colors hover:text-[#F3F0E8] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#8FAAD1]"
      >
        <Icon name="close" className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}