import { sliceRange } from "@/lib/analysis";
import { buildLinePath } from "@/lib/chart";
import { findCurrency } from "@/lib/currencies";
import { getHistory } from "@/lib/history";

// Async Server Component: the card streams it in through Suspense, so the history call never delays the prices
export async function Sparkline({ pair }: { pair: string }) {
  const currency = findCurrency(pair);
  if (!currency) return null;

  // A failed history call must never break the card, so only the fetch is guarded
  let history;
  try {
    history = await getHistory(currency.pair);
  } catch {
    return null;
  }

  const closes = sliceRange(history, "7D").map((p) => p.close);
  if (closes.length < 2) return null;

  const isUp = closes.at(-1)! >= closes[0];
  const color = isUp ? "text-green-600" : "text-red-600";

  // Decorative: the card's text already carries the price and change
  return (
    <div className="mt-3 flex items-end gap-2" aria-hidden="true">
      <svg viewBox="0 0 200 40" preserveAspectRatio="none" className={`h-10 flex-1 ${color}`}>
        <g className="chart-reveal">
          <path
            d={buildLinePath(closes, 200, 40)}
            fill="none"
            stroke="currentColor"
            strokeWidth={1.5}
            strokeLinejoin="round"
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
          />
        </g>
      </svg>
      <span className="text-xs text-zinc-400">7D</span>
    </div>
  );
}
