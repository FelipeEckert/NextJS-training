import type { PricePoint } from "@/lib/analysis";
import { buildLinePath } from "@/lib/chart";

// Fixed coordinates for the path; the viewBox stretches it to the card width
const WIDTH = 640;
const HEIGHT = 200;

export function PriceChart({ points }: { points: PricePoint[] }) {
  const first = points[0];
  const last = points[points.length - 1];
  const isUp = last.close >= first.close;

  return (
    <div className="mt-6">
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        preserveAspectRatio="none"
        className="h-48 w-full"
        role="img"
        aria-label={`Price chart from ${first.date} to ${last.date}`}
      >
        <path
          d={buildLinePath(points.map((p) => p.close), WIDTH, HEIGHT)}
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          vectorEffect="non-scaling-stroke"
          className={isUp ? "text-green-600" : "text-red-600"}
        />
      </svg>

      <div className="mt-2 flex justify-between text-xs text-zinc-500 tabular-nums">
        <span>{first.date}</span>
        <span>{last.date}</span>
      </div>
    </div>
  );
}
