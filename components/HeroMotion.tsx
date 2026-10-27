"use client";

import { createContext, useContext, useState, type ReactNode } from "react";

const PausedContext = createContext(false);
export function useHeroPaused() {
  return useContext(PausedContext);
}

export function HeroMotion({ children }: { children: ReactNode }) {
  const [paused, setPaused] = useState(false);
  return (
    <section data-paused={paused} className="hero relative isolate mt-6 overflow-hidden rounded-3xl border border-zinc-200 dark:border-zinc-800">
      <PausedContext value={paused}>{children}</PausedContext>
      {/* The globe and the card glow loop forever, so they need a visible pause (WCAG 2.2.2) */}
      <button type="button" onClick={() => setPaused((p) => !p)}
        className="absolute bottom-4 right-4 z-20 rounded-md border border-zinc-300 bg-background/80 px-2.5 py-1 text-xs font-medium backdrop-blur hover:bg-zinc-100 motion-reduce:hidden dark:border-zinc-700 dark:hover:bg-zinc-900">
        {paused ? "Play animation" : "Pause animation"}
      </button>
    </section>
  );
}
