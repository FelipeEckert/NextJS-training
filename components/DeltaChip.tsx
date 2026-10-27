import type { ReactNode } from "react";

// The arrow carries the direction, so colour is never the only cue. value is the rounded number the caller shows
export function DeltaChip({ value, children }: { value: number; children: ReactNode }) {
  const arrow = value > 0 ? "▲" : value < 0 ? "▼" : "";
  const tone =
    value > 0
      ? "text-gain bg-gain/10"
      : value < 0
        ? "text-loss bg-loss/10"
        : "text-zinc-600 dark:text-zinc-400 bg-zinc-500/10";

  return (
    <span className={`whitespace-nowrap rounded-md px-1.5 py-0.5 text-sm font-medium tabular-nums ${tone}`}>
      {arrow && <span aria-hidden="true">{arrow} </span>}
      {children}
    </span>
  );
}
