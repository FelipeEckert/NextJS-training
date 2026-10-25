import type { Metadata } from "next";
import { Suspense, type ReactNode } from "react";
import { PriceChart } from "@/components/PriceChart";
import { type PricePoint, sliceRange } from "@/lib/analysis";
import {
  type BacktestResult,
  DEFAULTS,
  parseBacktestParams,
  runBacktest,
  type Strategy,
} from "@/lib/backtest";
import { CATALOG } from "@/lib/currencies";
import { formatBRL } from "@/lib/format";
import { getHistory } from "@/lib/history";

export const metadata: Metadata = { title: "Backtest" };

export default function BacktestPage({ searchParams }: PageProps<"/backtest">) {
  return (
    <main className="mx-auto w-full max-w-3xl p-8">
      <h1 className="text-3xl font-bold">Backtest</h1>
      <p className="mt-2 text-zinc-500">
        See how a simple strategy would have done over the last year, against buying and holding.
      </p>
      <Suspense fallback={<p className="mt-6 text-zinc-500">Running the backtest…</p>}>
        <BacktestPanel searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

// Reads the URL, so the form pre-fills from the request and the results render per request
async function BacktestPanel({ searchParams }: Pick<PageProps<"/backtest">, "searchParams">) {
  const sp = await searchParams;
  // A repeated param arrives as an array, so only a single string counts
  const field = (name: string) => (typeof sp[name] === "string" ? sp[name] : DEFAULTS[name]);
  const parsed = parseBacktestParams(sp);

  return (
    <>
      <form method="get" action="/backtest" className="mt-6 grid gap-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="grid gap-1 text-sm font-medium">
            Currency
            <select name="pair" defaultValue={field("pair")} className={inputClass}>
              {CATALOG.map((c) => (
                <option key={c.pair} value={c.pair}>
                  {c.label}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-1 text-sm font-medium">
            Strategy
            <select name="kind" defaultValue={field("kind")} className={inputClass}>
              <option value="hold">Buy and hold</option>
              <option value="dip">Buy the dip</option>
              <option value="ma">Moving-average crossover</option>
            </select>
          </label>
        </div>

        <fieldset className="grid gap-4 sm:grid-cols-3">
          <legend className="text-sm font-semibold">Buy the dip</legend>
          <NumberField label="Drop (%)" name="dropPct" step="0.1" value={field("dropPct")} />
          <NumberField
            label="Lookback (days)"
            name="lookbackDays"
            step="1"
            value={field("lookbackDays")}
          />
          <NumberField
            label="Take profit (%)"
            name="takeProfitPct"
            step="0.1"
            value={field("takeProfitPct")}
          />
        </fieldset>

        <fieldset className="grid gap-4 sm:grid-cols-2">
          <legend className="text-sm font-semibold">Moving-average crossover</legend>
          <NumberField
            label="Short average (days)"
            name="shortDays"
            step="1"
            value={field("shortDays")}
          />
          <NumberField
            label="Long average (days)"
            name="longDays"
            step="1"
            value={field("longDays")}
          />
        </fieldset>

        <button
          type="submit"
          className="justify-self-start rounded-lg bg-zinc-900 px-4 py-2 font-medium text-white dark:bg-zinc-100 dark:text-zinc-900"
        >
          Run backtest
        </button>
      </form>

      {parsed.ok ? (
        <BacktestResults pair={parsed.pair} strategy={parsed.strategy} />
      ) : (
        <p role="alert" className="mt-6 text-sm text-red-600">
          {parsed.error}
        </p>
      )}
    </>
  );
}

async function BacktestResults({
  pair,
  strategy,
}: {
  pair: string;
  strategy: Strategy;
}) {
  let history: PricePoint[] = [];
  try {
    history = await getHistory(pair);
  } catch {
    // Treated like missing history below, so the page still renders
  }

  const lastYear = sliceRange(history, "1Y");
  if (lastYear.length === 0) {
    return <p className="mt-6 text-zinc-500">History unavailable for this currency right now.</p>;
  }

  // Both runs start on the same day, so the two curves line up on the chart
  const fromDate = lastYear[0].date;
  const result = runBacktest(history, strategy, fromDate);
  const hold = runBacktest(history, { kind: "hold" }, fromDate);
  const isHold = strategy.kind === "hold";

  return (
    <>
      <section className="mt-8 grid gap-6">
        <ResultRow label="Strategy" result={result} />
        {!isHold && <ResultRow label="Buy and hold" result={hold} />}
      </section>

      {result.equity.length >= 2 && (
        <PriceChart points={result.equity} compare={isHold ? undefined : hold.equity} />
      )}

      <p className="mt-6 text-sm text-zinc-500">
        Simulated on daily closing prices, no spread or fees.
      </p>
    </>
  );
}

function ResultRow({ label, result }: { label: string; result: BacktestResult }) {
  // Round first, so a tiny negative return shows as flat instead of "-0.00%"
  const returnPct = Number(result.returnPct.toFixed(2));
  const sign = returnPct > 0 ? "+" : "";
  const color = returnPct > 0 ? "text-green-600" : returnPct < 0 ? "text-red-600" : "";

  return (
    <div>
      <h2 className="text-lg font-semibold">{label}</h2>
      <dl className="mt-2 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Stat label="Final value">{formatBRL(result.finalValue)}</Stat>
        <Stat label="Return">
          <span className={color}>{`${sign}${returnPct.toFixed(2)}%`}</span>
        </Stat>
        <Stat label="Trades">{result.trades}</Stat>
        <Stat label="Max drawdown">{`${result.maxDrawdownPct.toFixed(2)}%`}</Stat>
      </dl>
    </div>
  );
}

function Stat({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
      <dt className="text-sm text-zinc-500">{label}</dt>
      <dd className="mt-1 text-lg font-semibold tabular-nums">{children}</dd>
    </div>
  );
}

function NumberField({
  label,
  name,
  step,
  value,
}: {
  label: string;
  name: string;
  step: string;
  value: string;
}) {
  return (
    <label className="grid gap-1 text-sm font-medium">
      {label}
      <input type="number" name={name} step={step} defaultValue={value} className={inputClass} />
    </label>
  );
}

const inputClass =
  "rounded-lg border border-zinc-300 px-3 py-2 font-normal tabular-nums dark:border-zinc-700 dark:bg-zinc-900";
