// Pure ranking: no database, no Next.js. Money in cents, quantities as bigint with QTY_SCALE decimals.
import { valuePortfolio, type Position } from "./portfolio";

export type LeaderboardWallet = { username: string; cashCents: number; positions: Position[] };

export type LeaderboardRow = { username: string; totalCents: number; returnPct: number };

const TOP_COUNT = 10;

// null when any position has no bid: one missing trader would make the ranking quietly wrong
export function rankWallets(
  wallets: LeaderboardWallet[],
  bids: Map<string, bigint>,
): LeaderboardRow[] | null {
  const rows: LeaderboardRow[] = [];
  for (const wallet of wallets) {
    const { totalCents, returnPct } = valuePortfolio(wallet.cashCents, wallet.positions, bids);
    if (totalCents === null || returnPct === null) return null;
    rows.push({ username: wallet.username, totalCents, returnPct });
  }

  rows.sort((a, b) => b.returnPct - a.returnPct || a.username.localeCompare(b.username));
  return rows.slice(0, TOP_COUNT);
}
