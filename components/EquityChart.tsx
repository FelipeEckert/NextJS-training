import type { PricePoint } from "@/lib/analysis";
import { buildLinePath } from "@/lib/chart";

// Fixed coordinates for the path; the viewBox stretches it to the card width
const WIDTH = 640;
const HEIGHT = 200;

// Each series has a color and a dash pattern, so identity never rests on color alone
const STYLES = [
  { color: "text-[#2a78d6] dark:text-[#3987e5]", dash: undefined, border: "border-solid" },
  { color: "text-[#eb6834] dark:text-[#d95926]", dash: "6 4", border: "border-dashed" },
  { color: "text-[#1baf7a] dark:text-[#199e70]", dash: "2 3", border: "border-dotted" },
] as const;

// One shared scale, so the lines can be read against each other
export function EquityChart({ series }: { series: { label: string; points: PricePoint[] }[] }) {
  const all = series.flatMap((s) => s.points.map((p) => p.close));
  const domain: [number, number] = [Math.min(...all), Math.max(...all)];
  const { points } = series[0];
  const first = points[0];
  const last = points[points.length - 1];
  const names = series.map((s) => s.label);
  const list = names.length > 1 ? `${names.slice(0, -1).join(", ")} and ${names.at(-1)}` : names[0];

  return (
    <div className="mt-6">
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        preserveAspectRatio="none"
        className="h-48 w-full"
        role="img"
        aria-label={`Equity of ${list} from ${first.date} to ${last.date}`}
      >
        {series.map((s, i) => (
          <g key={s.label} className="chart-reveal" style={{ animationDelay: `${i * 120}ms` }}>
            <path
              d={buildLinePath(s.points.map((p) => p.close), WIDTH, HEIGHT, domain)}
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              strokeDasharray={STYLES[i].dash}
              vectorEffect="non-scaling-stroke"
              className={STYLES[i].color}
            />
          </g>
        ))}
      </svg>

      <div className="mt-2 flex justify-between text-xs text-zinc-500 tabular-nums">
        <span>{first.date}</span>
        <span>{last.date}</span>
      </div>

      <ul className="mt-2 flex flex-wrap gap-4 text-xs text-zinc-500">
        {series.map((s, i) => (
          <li key={s.label} className="flex items-center gap-1">
            <span
              aria-hidden="true"
              className={`inline-block w-4 border-t-2 border-current ${STYLES[i].color} ${STYLES[i].border}`}
            />
            {s.label}
          </li>
        ))}
      </ul>
    </div>
  );
}
