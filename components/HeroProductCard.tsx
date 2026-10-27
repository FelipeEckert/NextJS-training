import { DeltaChip } from "@/components/DeltaChip";
import { sliceRange } from "@/lib/analysis";
import { buildLinePath } from "@/lib/chart";
import { formatBRL } from "@/lib/format";
import { getHistory } from "@/lib/history";
import { getQuote } from "@/lib/quotes";

// A decorative illustration of the product: the real prices are in the cards below
export async function HeroProductCard() {
  const [quote, history] = await Promise.all([
    getQuote("USD-BRL").catch(() => undefined),
    getHistory("USD-BRL").catch(() => []),
  ]);
  if (!quote) return null;

  const closes = sliceRange(history, "1M").map((p) => p.close);
  const line = closes.length >= 2 ? buildLinePath(closes, 300, 80) : "";
  const area = line ? `${line}L300,80L0,80Z` : "";
  const day = Number(quote.change.toFixed(2));
  const bought = (100 / quote.price).toFixed(2);

  return (
    <div aria-hidden="true" inert className="relative hidden h-[440px] lg:block">
      <div className="hero-wallet-ring absolute right-0 top-3 w-[290px] rotate-[4deg] rounded-[19px] p-px">
        <div className="rounded-[18px] bg-background p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-zinc-500">Your wallet</span>
            <span className="rounded-full bg-indigo-500/10 px-2 py-0.5 text-[11px] font-semibold text-indigo-600 dark:text-indigo-300">Paper</span>
          </div>
          <p className="mt-1.5 text-xs text-zinc-500">Total value</p>
          <p className="mt-0.5 text-2xl font-semibold tracking-tight tabular-nums">R$100,072.34</p>
          <div className="mt-2">
            <DeltaChip value={0.07}>+0.07% since you started</DeltaChip>
          </div>
          <div className="mt-3.5 flex h-2 gap-0.5 overflow-hidden rounded-full">
            <div className="w-[8%] bg-indigo-500" />
            <div className="w-[3%] bg-violet-500" />
            <div className="flex-1 bg-zinc-300 dark:bg-zinc-700" />
          </div>
          <div className="mt-2 flex gap-3 text-[11px] text-zinc-500">
            <span>● USD 8%</span>
            <span>● GBP 3%</span>
            <span>● Cash 89%</span>
          </div>
        </div>
      </div>

      <div className="beam absolute left-0 top-[70px] w-[380px] -rotate-2 rounded-[22px] bg-zinc-200 p-[1.5px] shadow-[0_30px_70px_-30px_rgba(79,70,229,0.45)] dark:bg-zinc-800">
        <div className="relative overflow-hidden rounded-[20.5px] bg-background/85 p-6 backdrop-blur-md">
          <div className="sheen pointer-events-none absolute inset-0" />
          <div className="flex items-center justify-between">
            <span className="text-sm text-zinc-500">US Dollar · USD/BRL</span>
            <span className="flex items-center gap-1.5 text-xs font-medium text-zinc-500">
              <span className="live size-1.5 rounded-full bg-green-500" /> Live
            </span>
          </div>
          <div className="mt-2 flex items-baseline gap-3">
            <span className="text-4xl font-semibold tracking-tight tabular-nums">{formatBRL(quote.price)}</span>
            <DeltaChip value={day}>{`${day > 0 ? "+" : ""}${day.toFixed(2)}%`}</DeltaChip>
            <span className="text-xs text-zinc-500">24h</span>
          </div>
          {line && (
            <svg viewBox="0 -4 300 88" preserveAspectRatio="none" className="mt-3 h-[84px] w-full">
              <defs>
                <linearGradient id="hpcSpark" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#16a34a" stopOpacity="0.22" />
                  <stop offset="100%" stopColor="#16a34a" stopOpacity="0" />
                </linearGradient>
              </defs>
              <g className="chart-reveal">
                <path d={area} fill="url(#hpcSpark)" />
                <path d={line} fill="none" stroke="#16a34a" strokeWidth="2" vectorEffect="non-scaling-stroke" />
              </g>
            </svg>
          )}
          <div className="mt-4 grid grid-cols-2 gap-1 rounded-lg bg-zinc-500/10 p-1 text-center text-sm font-medium">
            <span className="rounded-md bg-brand py-1.5 text-white">Buy</span>
            <span className="py-1.5 text-zinc-500">Sell</span>
          </div>
          <div className="mt-3 flex items-center justify-between rounded-lg border border-zinc-200 px-3 py-2 text-sm dark:border-zinc-800">
            <span className="text-zinc-500">Amount (R$)</span>
            <span className="font-medium tabular-nums">100.00</span>
          </div>
          <p className="mt-3 flex items-center gap-1.5 text-sm text-green-700 dark:text-green-400">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="size-4">
              <path d="M5 12.5l4.5 4.5L19 7.5" />
            </svg>
            Bought {bought} USD for R$100.00
          </p>
        </div>
      </div>
    </div>
  );
}
