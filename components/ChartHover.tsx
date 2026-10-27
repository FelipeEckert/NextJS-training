"use client";

import { useState, type KeyboardEvent, type PointerEvent } from "react";
import { nearestIndex, scaleY } from "@/lib/chart";
import { formatBRL } from "@/lib/format";

type Series = { label: string; values: number[]; colorClass: string };

// Sits over an SVG chart that stretches to the box, so every position is a percent of it
export function ChartHover({
  dates,
  series,
  domain,
  ariaLabel,
}: {
  dates: string[];
  series: Series[];
  domain: [number, number];
  ariaLabel: string;
}) {
  const [index, setIndex] = useState<number | null>(null);
  const [announcement, setAnnouncement] = useState("");
  if (dates.length === 0) return null;

  const last = dates.length - 1;
  const xPercent = (i: number) => (last === 0 ? 0 : (i / last) * 100);
  const describe = (i: number) =>
    `${dates[i]}: ${series
      .filter((s) => i < s.values.length)
      .map((s) => `${s.label} ${formatBRL(s.values[i])}`)
      .join(", ")}`;

  function locate(e: PointerEvent<HTMLDivElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    setIndex(nearestIndex(e.clientX - rect.left, rect.width, dates.length));
  }

  function onKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    const current = index ?? last;
    const next = keyTarget(e.key, current, last);
    if (next === null) return;
    e.preventDefault(); // the arrows would otherwise scroll the page
    setIndex(next);
    // Only keyboard moves are announced; pointer moves would flood the screen reader
    setAnnouncement(describe(next));
  }

  const showRight = index !== null && xPercent(index) >= 50;

  return (
    <>
      <div
        role="group"
        aria-label={ariaLabel}
        tabIndex={0}
        onPointerMove={locate}
        onPointerDown={locate}
        onPointerLeave={() => setIndex(null)}
        onFocus={() => setIndex((prev) => prev ?? last)}
        onBlur={() => setIndex(null)}
        onKeyDown={onKeyDown}
        style={{ touchAction: "pan-y" }}
        className="absolute inset-0 focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-inset focus-visible:outline-none"
      >
        {index !== null && (
          <div aria-hidden="true" className="pointer-events-none">
            <div
              className="absolute top-0 bottom-0 w-px -translate-x-1/2 bg-zinc-400/60"
              style={{ left: `${xPercent(index)}%` }}
            />
            {series.map(
              (s) =>
                index < s.values.length && (
                  <div
                    key={s.label}
                    className={`absolute size-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-current ring-2 ring-background ${s.colorClass}`}
                    style={{
                      left: `${xPercent(index)}%`,
                      top: `${scaleY(s.values[index], 100, domain)}%`,
                    }}
                  />
                ),
            )}
            <div
              className={`absolute top-2 whitespace-nowrap rounded-lg border border-zinc-200 bg-background/95 px-2 py-1 text-xs tabular-nums shadow-sm dark:border-zinc-800 ${showRight ? "mr-3" : "ml-3"}`}
              style={
                showRight
                  ? { right: `${100 - xPercent(index)}%` }
                  : { left: `${xPercent(index)}%` }
              }
            >
              <p className="font-medium">{dates[index]}</p>
              {series.map(
                (s) =>
                  index < s.values.length && (
                    <p key={s.label} className="flex items-center gap-1.5">
                      <span className={`inline-block size-2 rounded-full bg-current ${s.colorClass}`} />
                      <span className="text-zinc-500">{s.label}</span>
                      <span className="ml-auto pl-2">{formatBRL(s.values[index])}</span>
                    </p>
                  ),
              )}
            </div>
          </div>
        )}
      </div>
      <div aria-live="polite" className="sr-only">
        {announcement}
      </div>
    </>
  );
}

// The index a navigation key moves to, or null for keys we do not handle
function keyTarget(key: string, current: number, last: number): number | null {
  switch (key) {
    case "ArrowLeft":
      return Math.max(0, current - 1);
    case "ArrowRight":
      return Math.min(last, current + 1);
    case "Home":
      return 0;
    case "End":
      return last;
    default:
      return null;
  }
}
