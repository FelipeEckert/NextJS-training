import "server-only";

import { eq, inArray, ne } from "drizzle-orm";

import { getDb } from "./db";
import { positions, users, wallets } from "./db/schema";
import type { LeaderboardWallet } from "./leaderboard";
import { parseDecimal, QTY_SCALE } from "./money";
import { DEMO_USERNAME } from "./users";

// shortcut: values every account on each request; cache or precompute when users grow
export async function getAllWallets(): Promise<LeaderboardWallet[]> {
  const db = getDb();
  const walletRows = await db
    .select({ userId: wallets.userId, username: users.username, cashCents: wallets.cashCents })
    .from(wallets)
    .innerJoin(users, eq(wallets.userId, users.id))
    .where(ne(users.username, DEMO_USERNAME));
  if (walletRows.length === 0) return [];

  const positionRows = await db
    .select()
    .from(positions)
    .where(inArray(positions.userId, walletRows.map((row) => row.userId)));

  const positionsByUser = new Map<number, LeaderboardWallet["positions"]>();
  for (const row of positionRows) {
    const list = positionsByUser.get(row.userId) ?? [];
    list.push({
      pair: row.pair,
      quantity: parseDecimal(row.quantity, QTY_SCALE)!,
      costCents: row.costCents,
    });
    positionsByUser.set(row.userId, list);
  }

  return walletRows.map((row) => ({
    username: row.username,
    cashCents: row.cashCents,
    positions: positionsByUser.get(row.userId) ?? [],
  }));
}
