"use client";

import { useState, type ReactNode } from "react";

export function TickerTape({ children }: { children: ReactNode }) {
  const [paused, setPaused] = useState(false);

  return (
    <section aria-label="Live quotes ticker" className="ticker mt-2 flex items-center gap-3" data-paused={paused}>
      <div className="ticker-viewport min-w-0 flex-1 overflow-hidden motion-reduce:overflow-x-auto">
        <div className="ticker-track flex w-max">
          <ul className="flex shrink-0 gap-6 pr-6">{children}</ul>
          {/* The copy only closes the loop, so assistive tech and the keyboard skip it */}
          <ul className="flex shrink-0 gap-6 pr-6" aria-hidden="true" inert>{children}</ul>
        </div>
      </div>
      {/* Moving live data needs a visible pause control (WCAG 2.2.2); hover alone doesn't reach keyboard or touch users */}
      <button
        type="button"
        onClick={() => setPaused((p) => !p)}
        aria-pressed={paused}
        className="shrink-0 rounded-md border border-zinc-300 px-2 py-1 text-xs font-medium hover:bg-zinc-100 motion-reduce:hidden dark:border-zinc-700 dark:hover:bg-zinc-900"
      >
        {paused ? "Play" : "Pause"}
      </button>
    </section>
  );
}
