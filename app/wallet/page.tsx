import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { Suspense, type ReactNode } from "react";
import { PriceChart } from "@/components/PriceChart";
import { ResetWalletButton } from "@/components/ResetWalletButton";
import type { PricePoint } from "@/lib/analysis";
import { findCurrency } from "@/lib/currencies";
import { formatBRL } from "@/lib/format";
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
      <Suspense fallback={<p className="mt-6 text-zinc-500">Loading your wallet…</p>}>
        <WalletDetails />
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

  return (
    <>
      <dl className="mt-6 grid gap-4 sm:grid-cols-3">
        <Card label="Total value">
          {totalCents === null ? "Price unavailable" : formatBRL(totalCents / 100)}
        </Card>
        <Card label={`Return since ${started}`}>
          {returnPct === null ? (
            "Price unavailable"
          ) : (
            <span className={gainClass(Number(returnPct.toFixed(2)))}>{percent(returnPct)}</span>
          )}
        </Card>
        <Card label="Cash">{formatBRL(wallet.cashCents / 100)}</Card>
      </dl>

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
        <div className="mt-4 overflow-x-auto">
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
              {rows.map((row) => {
                const quantity = Number(formatDecimal(row.quantity, QTY_SCALE));
                return (
                  <tr key={row.pair} className="border-t border-zinc-200 dark:border-zinc-800">
                    <td className="py-2 pr-4 font-medium">
                      <Link href={`/currency/${row.pair}`} className="hover:underline">
                        {findCurrency(row.pair)!.code}
                      </Link>
                    </td>
                    <td className="py-2 pr-4">{formatDecimal(row.quantity, QTY_SCALE)}</td>
                    <td className="py-2 pr-4">{formatBRL(row.costCents / 100 / quantity)}</td>
                    <td className="py-2 pr-4">
                      {row.valueCents === null
                        ? "Price unavailable"
                        : formatBRL(row.valueCents / 100)}
                    </td>
                    <td className="py-2">
                      {row.plCents === null ? (
                        "—"
                      ) : (
                        <span className={gainClass(row.plCents)}>
                          {`${plus(row.plCents)}${formatBRL(row.plCents / 100)}`}
                          {row.plPct !== null && ` (${percent(row.plPct)})`}
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <h2 className="mt-10 text-xl font-semibold">Trade history</h2>
      {trades.length === 0 ? (
        <p className="mt-4 text-zinc-500">No trades yet.</p>
      ) : (
        <div className="mt-4 overflow-x-auto">
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
              {trades.map((trade) => (
                <tr key={trade.id} className="border-t border-zinc-200 dark:border-zinc-800">
                  <td className="py-2 pr-4">
                    {trade.createdAt.toLocaleString("en-US", {
                      timeZone: "America/Sao_Paulo",
                      dateStyle: "medium",
                      timeStyle: "short",
                    })}
                  </td>
                  <td className="py-2 pr-4">{findCurrency(trade.pair)!.code}</td>
                  <td className="py-2 pr-4">{trade.side === "buy" ? "Buy" : "Sell"}</td>
                  <td className="py-2 pr-4">{formatDecimal(trade.quantity, QTY_SCALE)}</td>
                  <td className="py-2 pr-4">
                    {formatBRL(Number(formatDecimal(trade.price, QTY_SCALE)))}
                  </td>
                  <td className="py-2">{formatBRL(trade.totalCents / 100)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="mt-10">
        <ResetWalletButton />
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

// Show "+" only for a real gain, so a flat result reads as zero
function plus(value: number) {
  return value > 0 ? "+" : "";
}

// Round before picking the sign, so a tiny loss reads "0.00%" instead of "-0.00%"
function percent(value: number) {
  const shown = Number(value.toFixed(2));
  return `${plus(shown)}${shown.toFixed(2)}%`;
}

function gainClass(value: number) {
  if (value > 0) return "text-green-600";
  if (value < 0) return "text-red-600";
  return "";
}
