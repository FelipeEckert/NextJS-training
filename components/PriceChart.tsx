import type { PricePoint } from "@/lib/analysis";
import { buildLinePath } from "@/lib/chart";

// Fixed coordinates for the path; the viewBox stretches it to the card width
const WIDTH = 640;
const HEIGHT = 200;

// compare is drawn dashed on the same scale, so the two lines can be read against each other
export function PriceChart({ points, compare }: { points: PricePoint[]; compare?: PricePoint[] }) {
  const first = points[0];
  const last = points[points.length - 1];
  const isUp = last.close >= first.close;
  const closes = points.map((p) => p.close);
  const values = compare ? [...closes, ...compare.map((p) => p.close)] : closes;
  const domain: [number, number] | undefined = compare
    ? [Math.min(...values), Math.max(...values)]
    : undefined;
  const color = isUp ? "text-green-600" : "text-red-600";

  return (
    <div className="mt-6">
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        preserveAspectRatio="none"
        className="h-48 w-full"
        role="img"
        aria-label={`Price chart from ${first.date} to ${last.date}`}
      >
        {compare && (
          <path
            d={buildLinePath(compare.map((p) => p.close), WIDTH, HEIGHT, domain)}
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
      </svg>

      <div className="mt-2 flex justify-between text-xs text-zinc-500 tabular-nums">
        <span>{first.date}</span>
        <span>{last.date}</span>
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
