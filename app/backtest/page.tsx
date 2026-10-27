import type { Metadata } from "next";
import { Suspense, type ReactNode } from "react";
import { DeltaChip } from "@/components/DeltaChip";
import { EquityChart } from "@/components/EquityChart";
import { PriceChart } from "@/components/PriceChart";
import { type PricePoint, sliceRange } from "@/lib/analysis";
import {
  type BacktestResult,
  DEFAULTS,
  parseBacktestParams,
  parseCompareParams,
  runBacktest,
  STRATEGY_LABELS,
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
  const parsed = sp.kind === "compare" ? parseCompareParams(sp) : parseBacktestParams(sp);

  return (
    <>
      <form
        method="get"
        action="/backtest"
        className="backtest-form mt-6 grid gap-5 rounded-2xl border border-zinc-200 bg-zinc-50/60 p-6 dark:border-zinc-800 dark:bg-zinc-900/40"
      >
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
              {Object.entries(STRATEGY_LABELS).map(([kind, label]) => (
                <option key={kind} value={kind}>
                  {label}
                </option>
              ))}
              <option value="compare">Compare all</option>
            </select>
          </label>
        </div>

        <fieldset
          data-strategy="dip"
          className="grid gap-4 rounded-xl border border-zinc-200 p-4 dark:border-zinc-800 sm:grid-cols-3"
        >
          <legend className="px-1 text-sm font-semibold">Buy the dip</legend>
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

        <fieldset
          data-strategy="ma"
          className="grid gap-4 rounded-xl border border-zinc-200 p-4 dark:border-zinc-800 sm:grid-cols-2"
        >
          <legend className="px-1 text-sm font-semibold">Moving-average crossover</legend>
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

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-zinc-200 pt-5 dark:border-zinc-800">
          <p className="text-sm text-zinc-500">Runs on the last year of daily closes.</p>
          <button
            type="submit"
            className="rounded-lg bg-brand shadow-md shadow-indigo-500/20 px-4 py-2 font-medium text-white hover:brightness-110"
          >
            Run backtest
          </button>
        </div>
      </form>

      {parsed.ok ? (
        "strategies" in parsed ? (
          <CompareResults pair={parsed.pair} strategies={parsed.strategies} />
        ) : (
          <BacktestResults pair={parsed.pair} strategy={parsed.strategy} />
        )
      ) : (
        <p role="alert" className="mt-6 text-sm text-red-600">
          {parsed.error}
        </p>
      )}
    </>
  );
}

// Both views need the full history (indicators read it) and the first day of the last year
async function loadBacktestWindow(pair: string): Promise<{ history: PricePoint[]; fromDate: string } | null> {
  let history: PricePoint[] = [];
  try {
    history = await getHistory(pair);
  } catch {
    // Treated like missing history below, so the page still renders
  }

  const lastYear = sliceRange(history, "1Y");
  if (lastYear.length === 0) return null;
  return { history, fromDate: lastYear[0].date };
}

function HistoryUnavailable() {
  return <p className="mt-6 text-zinc-500">History unavailable for this currency right now.</p>;
}

async function BacktestResults({
  pair,
  strategy,
}: {
  pair: string;
  strategy: Strategy;
}) {
  const loaded = await loadBacktestWindow(pair);
  if (!loaded) return <HistoryUnavailable />;

  // Both runs start on the same day, so the two curves line up on the chart
  const { history, fromDate } = loaded;
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

async function CompareResults({ pair, strategies }: { pair: string; strategies: Strategy[] }) {
  const loaded = await loadBacktestWindow(pair);
  if (!loaded) return <HistoryUnavailable />;

  const { history, fromDate } = loaded;
  const results = strategies.map((s) => runBacktest(history, s, fromDate));
  const series = strategies.map((s, i) => ({ label: STRATEGY_LABELS[s.kind], points: results[i].equity }));

  return (
    <>
      <div className="mt-8 overflow-x-auto">
        <table className="w-full text-sm tabular-nums">
          <caption className="sr-only">Results for the last year, one row per strategy</caption>
          <thead>
            <tr className="border-b border-zinc-200 text-left text-zinc-500 dark:border-zinc-800">
              <th scope="col" className="py-2 font-medium">Strategy</th>
              <th scope="col" className="py-2 font-medium">Final value</th>
              <th scope="col" className="py-2 font-medium">Return</th>
              <th scope="col" className="py-2 font-medium">Trades</th>
              <th scope="col" className="py-2 font-medium">Max drawdown</th>
            </tr>
          </thead>
          <tbody>
            {strategies.map((s, i) => {
              const result = results[i];
              const ret = formatReturn(result.returnPct);
              return (
                <tr key={s.kind} className="border-b border-zinc-200 dark:border-zinc-800">
                  <th scope="row" className="py-2 text-left font-medium">{STRATEGY_LABELS[s.kind]}</th>
                  <td className="py-2">{formatBRL(result.finalValue)}</td>
                  <td className="py-2">
                    <DeltaChip value={ret.value}>{ret.text}</DeltaChip>
                  </td>
                  <td className="py-2">{result.trades}</td>
                  <td className="py-2">{`${result.maxDrawdownPct.toFixed(2)}%`}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {series.every((s) => s.points.length >= 2) && <EquityChart series={series} />}

      <p className="mt-6 text-sm text-zinc-500">
        Simulated on daily closing prices, no spread or fees.
      </p>
    </>
  );
}

// Round first, so a tiny negative return shows as flat instead of "-0.00%"
function formatReturn(returnPct: number) {
  const rounded = Number(returnPct.toFixed(2));
  const sign = rounded > 0 ? "+" : "";
  return { text: `${sign}${rounded.toFixed(2)}%`, value: rounded };
}

function ResultRow({ label, result }: { label: string; result: BacktestResult }) {
  const ret = formatReturn(result.returnPct);

  return (
    <div>
      <h2 className="text-lg font-semibold">{label}</h2>
      <dl className="mt-2 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Stat label="Final value">{formatBRL(result.finalValue)}</Stat>
        <Stat label="Return">
          <DeltaChip value={ret.value}>{ret.text}</DeltaChip>
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
  "rounded-lg border border-zinc-300 px-3 py-2 font-normal tabular-nums bg-background dark:border-zinc-700 dark:bg-zinc-900";
