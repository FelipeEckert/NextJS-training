import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { Suspense, ViewTransition, type CSSProperties, type ReactNode } from "react";
import { DeltaChip } from "@/components/DeltaChip";
import { PriceChart } from "@/components/PriceChart";
import { ResetWalletButton } from "@/components/ResetWalletButton";
import type { PricePoint } from "@/lib/analysis";
import { findCurrency } from "@/lib/currencies";
import { formatBRL, formatQuantity } from "@/lib/format";
import { getHistory } from "@/lib/history";
import { formatDecimal, parseDecimal, QTY_SCALE, STARTING_CASH_CENTS } from "@/lib/money";
import { valuePortfolio } from "@/lib/portfolio";
import { portfolioHistory } from "@/lib/portfolio-history";
import { getQuotes } from "@/lib/quotes";
import { getCurrentUser } from "@/lib/session";
import { getWallet, listTrades } from "@/lib/trading";

export const metadata: Metadata = { title: "Your wallet" };

export default function WalletPage() {
  return (
    <main className="mx-auto w-full max-w-5xl p-8">
      <h1 className="text-3xl font-bold">Your wallet</h1>
      <Suspense
        fallback={
          <ViewTransition exit="slide-down" default="none">
            <WalletSkeleton />
          </ViewTransition>
        }
      >
        <ViewTransition enter="slide-up" default="none">
          <WalletDetails />
        </ViewTransition>
      </Suspense>
    </main>
  );
}

async function WalletDetails() {
  // Defense in depth: the proxy already redirected visitors without a cookie,
  // but we never trust it alone (see app/favorites/page.tsx)
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/wallet");

  await connection(); // the DB driver draws random bytes; defer them to request time
  const [wallet, allTrades] = await Promise.all([
    getWallet(user.id),
    // shortcut: loads every trade; page through them if accounts reach thousands of trades
    listTrades(user.id, 10_000),
  ]);
  const trades = allTrades.slice(0, 100); // the table shows the latest 100

  // Prices only for held pairs. If the quote API is down, rows show "Price unavailable" instead of failing the page
  const bids = new Map<string, bigint>();
  if (wallet.positions.length > 0) {
    try {
      const { quotes } = await getQuotes(wallet.positions.map((position) => position.pair));
      for (const quote of quotes) {
        const bid = parseDecimal(quote.bid, QTY_SCALE);
        if (bid !== null) bids.set(quote.pair, bid);
      }
    } catch {
      // keep the empty map: every position then shows "Price unavailable"
    }
  }

  const { rows, totalCents, returnPct } = valuePortfolio(
    wallet.cashCents,
    wallet.positions,
    bids,
  );
  const started = wallet.startedAt.toLocaleDateString("en-US", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "short",
    day: "numeric",
  });

  // Replays every trade over daily closes. If a price history fails, the chart stays hidden
  const startDate = wallet.startedAt.toISOString().slice(0, 10);
  const today = new Date().toISOString().slice(0, 10);
  const chronological = [...allTrades].reverse().map((trade) => ({
    date: trade.createdAt.toISOString().slice(0, 10),
    pair: trade.pair,
    side: trade.side,
    quantity: trade.quantity,
    totalCents: trade.totalCents,
  }));
  const pairs = [...new Set(allTrades.map((trade) => trade.pair))];
  let chart: PricePoint[] | null = null;
  try {
    const histories = await Promise.all(pairs.map((pair) => getHistory(pair)));
    chart = portfolioHistory({
      startDate,
      startingCashCents: STARTING_CASH_CENTS,
      trades: chronological,
      prices: Object.fromEntries(pairs.map((pair, i) => [pair, histories[i]])),
      today,
    });
  } catch {
    // keep chart null: the section is then left out
  }

  // The bar needs a positive total to split; without one it is left out
  const segments =
    totalCents !== null && totalCents > 0
      ? allocationSegments(rows, wallet.cashCents, totalCents)
      : null;

  return (
    <>
      <dl className="mt-6 grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-zinc-200 p-5 sm:col-span-2 dark:border-zinc-800">
          <dt className="text-sm text-zinc-500">Total value</dt>
          <dd className="mt-1 text-4xl font-semibold tracking-tight tabular-nums">
            {totalCents === null ? "Price unavailable" : formatBRL(totalCents / 100)}
          </dd>
          <dd className="mt-3 flex flex-wrap items-center gap-2 text-sm text-zinc-500">
            {returnPct === null ? (
              "Price unavailable"
            ) : (
              <DeltaChip value={Number(returnPct.toFixed(2))}>{percent(returnPct)}</DeltaChip>
            )}
            <span>since {started}</span>
          </dd>
        </div>
        <Card label="Cash">{formatBRL(wallet.cashCents / 100)}</Card>
      </dl>

      {segments && (
        <section
          aria-labelledby="allocation"
          className="mt-4 rounded-xl border border-zinc-200 p-5 dark:border-zinc-800"
        >
          <h2 id="allocation" className="text-sm text-zinc-500">
            Allocation
          </h2>
          <div className="mt-3 flex h-3 gap-0.5 overflow-hidden rounded-full" aria-hidden="true">
            {segments.map((s) => (
              <div key={s.label} className={`${s.color} min-w-1`} style={{ width: `${s.pct}%` }} />
            ))}
          </div>
          <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-sm">
            {segments.map((s) => (
              <li key={s.label} className="flex items-center gap-2">
                <span aria-hidden="true" className={`size-2.5 rounded-full ${s.color}`} />
                <span className="font-medium">{s.label}</span>
                <span className="tabular-nums text-zinc-500">{s.pct.toFixed(1)}%</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {chart && (
        <>
          <h2 className="mt-10 text-xl font-semibold">Value over time</h2>
          {chart.length >= 2 ? (
            <PriceChart points={chart} />
          ) : (
            <p className="mt-4 text-zinc-500">Your chart appears after your first full day.</p>
          )}
        </>
      )}

      <h2 className="mt-10 text-xl font-semibold">Positions</h2>
      {rows.length === 0 ? (
        <p className="mt-4 text-zinc-500">No positions yet.</p>
      ) : (
        <>
          <div className="mt-4 hidden overflow-x-auto sm:block">
            <table className="w-full text-left text-sm tabular-nums">
              <thead className="text-zinc-500">
                <tr>
                  <th className="py-2 pr-4 font-medium">Currency</th>
                  <th className="py-2 pr-4 font-medium">Quantity</th>
                  <th className="py-2 pr-4 font-medium">Average cost</th>
                  <th className="py-2 pr-4 font-medium">Value</th>
                  <th className="py-2 font-medium">P/L</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, index) => {
                  const quantity = Number(formatDecimal(row.quantity, QTY_SCALE));
                  return (
                    <tr
                      key={row.pair}
                      className="stagger-row border-t border-zinc-200 dark:border-zinc-800"
                      style={{ "--i": index } as CSSProperties}
                    >
                      <td className="py-2 pr-4 font-medium">
                        <Link href={`/currency/${row.pair}`} className="hover:underline">
                          {findCurrency(row.pair)!.code}
                        </Link>
                      </td>
                      <td className="py-2 pr-4">
                        <span title={formatDecimal(row.quantity, QTY_SCALE)}>
                          {formatQuantity(formatDecimal(row.quantity, QTY_SCALE))}
                        </span>
                      </td>
                      <td className="py-2 pr-4">{formatBRL(row.costCents / 100 / quantity)}</td>
                      <td className="py-2 pr-4">
                        {row.valueCents === null
                          ? "Price unavailable"
                          : formatBRL(row.valueCents / 100)}
                      </td>
                      <td className="py-2">{profitLoss(row.plCents, row.plPct)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <ul className="mt-4 space-y-3 sm:hidden">
            {rows.map((row) => {
              const quantity = Number(formatDecimal(row.quantity, QTY_SCALE));
              return (
                <li
                  key={row.pair}
                  className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-800"
                >
                  <div className="flex justify-between">
                    <Link href={`/currency/${row.pair}`} className="font-medium hover:underline">
                      {findCurrency(row.pair)!.code}
                    </Link>
                    <span className="tabular-nums">
                      {row.valueCents === null
                        ? "Price unavailable"
                        : formatBRL(row.valueCents / 100)}
                    </span>
                  </div>
                  <div className="mt-1 text-sm text-zinc-500 tabular-nums">
                    {formatQuantity(formatDecimal(row.quantity, QTY_SCALE))} · avg{" "}
                    {formatBRL(row.costCents / 100 / quantity)}
                  </div>
                  <div className="mt-2">{profitLoss(row.plCents, row.plPct)}</div>
                </li>
              );
            })}
          </ul>
        </>
      )}

      <h2 className="mt-10 text-xl font-semibold">Trade history</h2>
      {trades.length === 0 ? (
        <p className="mt-4 text-zinc-500">No trades yet.</p>
      ) : (
        <>
          <div className="mt-4 hidden overflow-x-auto sm:block">
            <table className="w-full text-left text-sm tabular-nums">
              <thead className="text-zinc-500">
                <tr>
                  <th className="py-2 pr-4 font-medium">Date</th>
                  <th className="py-2 pr-4 font-medium">Currency</th>
                  <th className="py-2 pr-4 font-medium">Side</th>
                  <th className="py-2 pr-4 font-medium">Quantity</th>
                  <th className="py-2 pr-4 font-medium">Price</th>
                  <th className="py-2 font-medium">Total</th>
                </tr>
              </thead>
              <tbody>
                {trades.map((trade, index) => (
                  <tr
                    key={trade.id}
                    className="stagger-row border-t border-zinc-200 dark:border-zinc-800"
                    style={{ "--i": index } as CSSProperties}
                  >
                    <td className="py-2 pr-4">{formatTradeDate(trade.createdAt)}</td>
                    <td className="py-2 pr-4">{findCurrency(trade.pair)!.code}</td>
                    <td className="py-2 pr-4">
                      <span className={SIDE_BADGE[trade.side]}>
                        {trade.side === "buy" ? "Buy" : "Sell"}
                      </span>
                    </td>
                    <td className="py-2 pr-4">
                      <span title={formatDecimal(trade.quantity, QTY_SCALE)}>
                        {formatQuantity(formatDecimal(trade.quantity, QTY_SCALE))}
                      </span>
                    </td>
                    <td className="py-2 pr-4">
                      {formatBRL(Number(formatDecimal(trade.price, QTY_SCALE)))}
                    </td>
                    <td className="py-2">{formatBRL(trade.totalCents / 100)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <ul className="mt-4 space-y-3 sm:hidden">
            {trades.map((trade) => {
              const quantity = formatQuantity(formatDecimal(trade.quantity, QTY_SCALE));
              return (
                <li
                  key={trade.id}
                  className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-800"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className={SIDE_BADGE[trade.side]}>
                        {trade.side === "buy" ? "Buy" : "Sell"}
                      </span>
                      <span className="font-medium">{findCurrency(trade.pair)!.code}</span>
                    </div>
                    <span className="tabular-nums">{formatBRL(trade.totalCents / 100)}</span>
                  </div>
                  <div className="mt-1 text-sm text-zinc-500 tabular-nums">
                    {formatTradeDate(trade.createdAt)} · {quantity} @{" "}
                    {formatBRL(Number(formatDecimal(trade.price, QTY_SCALE)))}
                  </div>
                </li>
              );
            })}
          </ul>
        </>
      )}

      <div className="mt-10">
        <ResetWalletButton />
      </div>
    </>
  );
}

// Mirrors the loaded layout so nothing jumps when the data arrives
const BAR = "rounded bg-zinc-200 dark:bg-zinc-800";

function WalletSkeleton() {
  return (
    <>
      <p className="sr-only">Loading your wallet…</p>
      <div aria-hidden="true" className="animate-pulse">
        <div className="mt-6 grid gap-4 sm:grid-cols-3">
          <div className="rounded-xl border border-zinc-200 p-5 sm:col-span-2 dark:border-zinc-800">
            <div className={`h-4 w-24 ${BAR}`} />
            <div className={`mt-2 h-10 w-48 ${BAR}`} />
          </div>
          <div className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
            <div className={`h-4 w-24 ${BAR}`} />
            <div className={`mt-2 h-6 w-32 ${BAR}`} />
          </div>
        </div>
        <div className="mt-4 rounded-xl border border-zinc-200 p-5 dark:border-zinc-800">
          <div className={`h-3 rounded-full ${BAR}`} />
        </div>
        <div className={`mt-10 h-48 ${BAR}`} />
        <div className="mt-10 space-y-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className={`h-8 ${BAR}`} />
          ))}
        </div>
      </div>
    </>
  );
}

function Card({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
      <dt className="text-sm text-zinc-500">{label}</dt>
      <dd className="mt-1 text-lg font-semibold tabular-nums">{children}</dd>
    </div>
  );
}

const SIDE_BADGE = {
  buy: "rounded-md bg-indigo-500/10 px-1.5 py-0.5 text-xs font-medium text-indigo-700 dark:text-indigo-300",
  sell: "rounded-md bg-amber-500/10 px-1.5 py-0.5 text-xs font-medium text-amber-700 dark:text-amber-300",
};

const POSITION_COLORS = [
  "bg-indigo-500",
  "bg-violet-500",
  "bg-sky-500",
  "bg-emerald-500",
  "bg-amber-500",
];

// Largest positions first, the rest folded into "Other", then Cash
function allocationSegments(
  rows: { pair: string; valueCents: number | null }[],
  cashCents: number,
  totalCents: number,
) {
  const priced = rows
    .filter(
      (row): row is { pair: string; valueCents: number } =>
        row.valueCents !== null && row.valueCents > 0,
    )
    .sort((a, b) => b.valueCents - a.valueCents);
  const segments = priced.slice(0, POSITION_COLORS.length).map((row, i) => ({
    label: findCurrency(row.pair)!.code,
    cents: row.valueCents,
    color: POSITION_COLORS[i],
  }));
  const otherCents = priced
    .slice(POSITION_COLORS.length)
    .reduce((sum, row) => sum + row.valueCents, 0);
  if (otherCents > 0) segments.push({ label: "Other", cents: otherCents, color: "bg-zinc-400" });
  segments.push({ label: "Cash", cents: cashCents, color: "bg-zinc-300 dark:bg-zinc-600" });
  return segments.map((s) => ({ ...s, pct: (s.cents / totalCents) * 100 }));
}

// Shared by the table and the phone card, so both show the same text
function formatTradeDate(date: Date) {
  return date.toLocaleString("en-US", {
    timeZone: "America/Sao_Paulo",
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function profitLoss(plCents: number | null, plPct: number | null) {
  if (plCents === null) return "—";
  return (
    <DeltaChip value={plCents}>
      {`${plus(plCents)}${formatBRL(plCents / 100)}`}
      {plPct !== null && ` (${percent(plPct)})`}
    </DeltaChip>
  );
}

// Show "+" only for a real gain, so a flat result reads as zero
function plus(value: number) {
  return value > 0 ? "+" : "";
}

// Round before picking the sign, so a tiny loss reads "0.00%" instead of "-0.00%"
function percent(value: number) {
  const shown = Number(value.toFixed(2));
  return `${plus(shown)}${shown.toFixed(2)}%`;
}
