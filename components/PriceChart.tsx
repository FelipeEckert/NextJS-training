import { useId } from "react";
import { ChartHover } from "@/components/ChartHover";
import type { PricePoint } from "@/lib/analysis";
import { buildAreaPath, buildLinePath } from "@/lib/chart";
import { formatBRL } from "@/lib/format";

// "2026-10-27" -> "Oct 27, 2026"; noon UTC keeps the day from shifting
function shortDate(date: string) {
  return new Date(date + "T12:00:00Z").toLocaleDateString("en-US", {
    timeZone: "UTC",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

// Fixed coordinates for the path; the viewBox stretches it to the card width
const WIDTH = 640;
const HEIGHT = 200;

// compare is drawn dashed on the same scale, so the two lines can be read against each other
export function PriceChart({ points, compare }: { points: PricePoint[]; compare?: PricePoint[] }) {
  const first = points[0];
  const last = points[points.length - 1];
  const isUp = last.close >= first.close;
  const closes = points.map((p) => p.close);
  const compareCloses = compare?.map((p) => p.close);
  const values = compareCloses ? [...closes, ...compareCloses] : closes;
  const domain: [number, number] = [Math.min(...values), Math.max(...values)];
  const color = isUp ? "text-green-600" : "text-red-600";
  const series = [
    { label: compare ? "Strategy" : "Price", values: closes, colorClass: color },
    ...(compareCloses ? [{ label: "Buy and hold", values: compareCloses, colorClass: "text-zinc-400" }] : []),
  ];
  // Server components have useId too, and its id is unique per request, so two charts on one page never clash
  const gradientId = useId();

  return (
    <div className="mt-6">
      <div className="relative">
        <svg
          viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
          preserveAspectRatio="none"
          className="h-48 w-full"
          role="img"
          aria-label={`Price chart from ${first.date} to ${last.date}`}
        >
          <g className="chart-reveal">
            {/* The stops carry the colour class: currentColor resolves on the stop, not on the filled path */}
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="currentColor" stopOpacity={0.25} className={color} />
              <stop offset="100%" stopColor="currentColor" stopOpacity={0} className={color} />
            </linearGradient>
            <path
              d={buildAreaPath(closes, WIDTH, HEIGHT, domain)}
              fill={`url(#${gradientId})`}
              stroke="none"
            />
            {compareCloses && (
              <path
                d={buildLinePath(compareCloses, WIDTH, HEIGHT, domain)}
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                strokeDasharray="4 4"
                vectorEffect="non-scaling-stroke"
                className="text-zinc-400"
              />
            )}
            <path
              d={buildLinePath(closes, WIDTH, HEIGHT, domain)}
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              vectorEffect="non-scaling-stroke"
              className={color}
            />
          </g>
        </svg>
        {/* The scale's ends, so the line reads as numbers; ChartHover gives exact values per day */}
        <span aria-hidden="true" className="pointer-events-none absolute right-0 top-0 rounded bg-background/70 px-1 text-xs text-zinc-500 tabular-nums">{formatBRL(domain[1])}</span>
        <span aria-hidden="true" className="pointer-events-none absolute bottom-0 right-0 rounded bg-background/70 px-1 text-xs text-zinc-500 tabular-nums">{formatBRL(domain[0])}</span>
        <ChartHover
          dates={points.map((p) => p.date)}
          series={series}
          domain={domain}
          ariaLabel="Chart values: use the arrow keys"
        />
      </div>

      <div className="mt-2 flex justify-between text-xs text-zinc-500 tabular-nums">
        <span>{shortDate(first.date)}</span>
        <span>{shortDate(last.date)}</span>
      </div>

      {compare && (
        <div className="mt-2 flex gap-4 text-xs text-zinc-500">
          <span className="flex items-center gap-1">
            <span className={`inline-block h-0.5 w-4 bg-current ${color}`} />
            Strategy
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block w-4 border-t-2 border-dashed border-zinc-400" />
            Buy and hold
          </span>
        </div>
      )}
    </div>
  );
}
