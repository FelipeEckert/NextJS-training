import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense, type CSSProperties } from "react";
import { DeltaChip } from "@/components/DeltaChip";
import { formatBRL } from "@/lib/format";
import { rankWallets } from "@/lib/leaderboard";
import { getAllWallets } from "@/lib/leaderboard-data";
import { parseDecimal, QTY_SCALE } from "@/lib/money";
import { HOUSE_BOT_USERNAME } from "@/lib/house-bot";
import { getQuotes } from "@/lib/quotes";

export const metadata: Metadata = { title: "Leaderboard" };

export default function LeaderboardPage() {
  return (
    <main className="mx-auto w-full max-w-5xl p-8">
      <h1 className="text-3xl font-bold">Leaderboard</h1>
      <Suspense fallback={<p className="mt-6 text-zinc-500">Loading the leaderboard…</p>}>
        <LeaderboardTable />
      </Suspense>
    </main>
  );
}

const UNAVAILABLE = <p className="mt-6 text-zinc-500">Leaderboard temporarily unavailable.</p>;

async function LeaderboardTable() {
  await connection(); // the DB driver draws random bytes; defer them to request time
  const wallets = await getAllWallets();
  if (wallets.length === 0) return <p className="mt-6 text-zinc-500">No traders yet.</p>;

  // Prices only for pairs somebody holds. If the quote API is down, the leaderboard is unavailable
  const pairs = [
    ...new Set(wallets.flatMap((wallet) => wallet.positions.map((position) => position.pair))),
  ];
  const bids = new Map<string, bigint>();
  if (pairs.length > 0) {
    try {
      const { quotes } = await getQuotes(pairs);
      for (const quote of quotes) {
        const bid = parseDecimal(quote.bid, QTY_SCALE);
        if (bid !== null) bids.set(quote.pair, bid);
      }
    } catch {
      return UNAVAILABLE;
    }
  }

  const ranked = rankWallets(wallets, bids);
  if (ranked === null) return UNAVAILABLE;

  return (
    <div className="mt-6 overflow-x-auto">
      <table className="w-full text-left text-sm tabular-nums">
        <thead className="text-zinc-500">
          <tr>
            <th className="py-2 pr-4 font-medium">#</th>
            <th className="py-2 pr-4 font-medium">Trader</th>
            <th className="py-2 pr-4 font-medium">Total value</th>
            <th className="py-2 font-medium">Return</th>
          </tr>
        </thead>
        <tbody>
          {ranked.map((row, index) => {
            // Round first, so a tiny negative return shows as flat instead of "-0.00%"
            const shown = Number(row.returnPct.toFixed(2));
            return (
              <tr
                key={row.username}
                className="stagger-row border-t border-zinc-200 dark:border-zinc-800"
                style={{ "--i": index } as CSSProperties}
              >
                <td className="py-2 pr-4">{index + 1}</td>
                <td className="py-2 pr-4 font-medium">
                  {row.username}
                  {row.username === HOUSE_BOT_USERNAME && (
                    <span className="ml-2 rounded border border-zinc-300 px-1.5 py-0.5 text-xs font-normal text-zinc-500 dark:border-zinc-700">
                      bot
                    </span>
                  )}
                </td>
                <td className="py-2 pr-4">{formatBRL(row.totalCents / 100)}</td>
                <td className="py-2">
                  <DeltaChip value={shown}>{`${plus(shown)}${shown.toFixed(2)}%`}</DeltaChip>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// Show "+" only for a real gain, so a flat result reads as zero
function plus(value: number) {
  return value > 0 ? "+" : "";
}
