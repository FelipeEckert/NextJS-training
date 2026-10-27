"use client";

import { useEffect, useRef, useState } from "react";

export function CopyButton({ text }: { text: string }) {
  const [status, setStatus] = useState<"idle" | "copied" | "failed">("idle");
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => () => clearTimeout(timer.current), []);

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setStatus("copied");
    } catch {
      setStatus("failed");
    }
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setStatus("idle"), 2000);
  }

  return (
    <>
      <button
        type="button"
        onClick={copy}
        className="absolute right-2 top-2 rounded-md border border-zinc-300 bg-white/80 px-2 py-1 text-xs font-medium backdrop-blur hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-950/80 dark:hover:bg-zinc-900"
      >
        {status === "copied" ? "Copied" : status === "failed" ? "Copy failed" : "Copy"}
      </button>
      {/* Announces the result, since the button label changing alone isn't always read out */}
      <span role="status" className="sr-only">
        {status === "copied" ? "Copied to clipboard" : status === "failed" ? "Copy failed" : ""}
      </span>
    </>
  );
}
