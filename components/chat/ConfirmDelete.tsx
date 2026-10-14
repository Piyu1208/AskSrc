"use client";

import { useEffect, useState } from "react";

import { Icon, Spinner } from "./icons";

/**
 * Trash button with a two-step confirm (no window.confirm popups).
 * Click once to arm, click "Delete" to confirm. Disarms itself after 4s.
 */
export function ConfirmDelete({
  label,
  busy = false,
  revealOnHover = false,
  onConfirm,
}: {
  label: string;
  busy?: boolean;
  /** Hide the idle button until the parent (`group`) is hovered — desktop only. */
  revealOnHover?: boolean;
  onConfirm: () => void;
}) {
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    if (!confirming) return;
    const t = window.setTimeout(() => setConfirming(false), 4000);
    return () => window.clearTimeout(t);
  }, [confirming]);

  if (busy) {
    return (
      <span className="p-1.5 text-[#8F8A7B]">
        <Spinner className="h-3.5 w-3.5" />
      </span>
    );
  }

  if (confirming) {
    return (
      <span className="flex items-center gap-1">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setConfirming(false);
            onConfirm();
          }}
          className="border border-[#E2725B] px-2 py-1 text-xs text-[#E2725B] transition-colors hover:bg-[#E2725B] hover:text-[#14130F] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#8FAAD1]"
        >
          Delete
        </button>
        <button
          type="button"
          aria-label="Cancel"
          onClick={(e) => {
            e.stopPropagation();
            setConfirming(false);
          }}
          className="p-1 text-[#8F8A7B] transition-colors hover:bg-[#2A281F] hover:text-[#F3F0E8] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#8FAAD1]"
        >
          <Icon name="close" className="h-3.5 w-3.5" />
        </button>
      </span>
    );
  }

  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={(e) => {
        e.stopPropagation();
        setConfirming(true);
      }}
      className={`p-1.5 text-[#8F8A7B] transition-colors hover:bg-[#2A281F] hover:text-[#E2725B] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#8FAAD1] ${
        revealOnHover
          ? "md:opacity-0 md:group-hover:opacity-100 md:focus-visible:opacity-100"
          : ""
      }`}
    >
      <Icon name="trash" className="h-3.5 w-3.5" />
    </button>
  );
}