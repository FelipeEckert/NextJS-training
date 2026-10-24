import "server-only";

import { createHash } from "node:crypto";

import { and, desc, eq } from "drizzle-orm";

import { getDb } from "./db";
import { positions, trades, wallets } from "./db/schema";
import {
  formatDecimal,
  parseDecimal,
  planTrade,
  QTY_SCALE,
  STARTING_CASH_CENTS,
  type PlanOrder,
  type TradeErrorCode,
} from "./money";
import type { TradeQuote } from "./trade-quote";

export type Order = { pair: string } & PlanOrder;

export type Trade = {
  id: number;
  pair: string;
  side: "buy" | "sell";
  quantity: bigint;
  price: bigint;
  totalCents: number;
  createdAt: Date;
};

export type TradeResult =
  | { ok: true; trade: Trade; replayed: boolean }
  | { ok: false; code: TradeErrorCode | "IDEMPOTENCY_MISMATCH"; message: string };

// Key order is fixed: the hash is stored and compared across requests
function requestHash(order: Order): string {
  const body =
    order.side === "buy"
      ? { pair: order.pair, side: order.side, brlCents: order.brlCents }
      : {
          pair: order.pair,
          side: order.side,
          quantity: order.quantity === "all" ? "all" : formatDecimal(order.quantity, QTY_SCALE),
        };
  return createHash("sha256").update(JSON.stringify(body)).digest("hex");
}

function toTrade(row: typeof trades.$inferSelect): Trade {
  return {
    id: row.id,
    pair: row.pair,
    side: row.side as "buy" | "sell",
    quantity: parseDecimal(row.quantity, QTY_SCALE)!,
    price: parseDecimal(row.price, QTY_SCALE)!,
    totalCents: row.totalCents,
    createdAt: row.createdAt,
  };
}

// The wallet row lock serializes trades per user, so the idempotency lookup after it sees the first trade
export async function executeTrade(
  userId: number,
  order: Order,
  quote: Pick<TradeQuote, "bid" | "ask">,
  idempotencyKey: string,
): Promise<TradeResult> {
  const hash = requestHash(order);

  return getDb().transaction(async (tx) => {
    const [wallet] = await tx
      .select({ cashCents: wallets.cashCents })
      .from(wallets)
      .where(eq(wallets.userId, userId))
      .for("update");
    if (!wallet) throw new Error("Wallet not found");

    const [existing] = await tx
      .select()
      .from(trades)
      .where(and(eq(trades.userId, userId), eq(trades.idempotencyKey, idempotencyKey)));
    if (existing) {
      if (existing.requestHash !== hash) {
        return {
          ok: false,
          code: "IDEMPOTENCY_MISMATCH",
          message: "This Idempotency-Key was already used for a different order.",
        };
      }
      return { ok: true, trade: toTrade(existing), replayed: true };
    }

    const [position] = await tx
      .select()
      .from(positions)
      .where(and(eq(positions.userId, userId), eq(positions.pair, order.pair)));
    const holding = position
      ? { quantity: parseDecimal(position.quantity, QTY_SCALE)!, costCents: position.costCents }
      : null;

    const plan = planTrade({ cashCents: wallet.cashCents, holding }, order, quote);
    if (!plan.ok) return { ok: false, code: plan.code, message: plan.message };

    await tx
      .update(wallets)
      .set({ cashCents: plan.cashCents })
      .where(eq(wallets.userId, userId));

    if (plan.holding) {
      const values = {
        quantity: formatDecimal(plan.holding.quantity, QTY_SCALE),
        costCents: plan.holding.costCents,
      };
      await tx
        .insert(positions)
        .values({ userId, pair: order.pair, ...values })
        .onConflictDoUpdate({ target: [positions.userId, positions.pair], set: values });
    } else {
      await tx
        .delete(positions)
        .where(and(eq(positions.userId, userId), eq(positions.pair, order.pair)));
    }

    const [row] = await tx
      .insert(trades)
      .values({
        userId,
        pair: order.pair,
        side: order.side,
        quantity: formatDecimal(plan.quantity, QTY_SCALE),
        price: formatDecimal(plan.price, QTY_SCALE),
        totalCents: plan.totalCents,
        idempotencyKey,
        requestHash: hash,
      })
      .returning();
    return { ok: true, trade: toTrade(row), replayed: false };
  });
}

export async function getWallet(userId: number): Promise<{
  cashCents: number;
  startedAt: Date;
  positions: { pair: string; quantity: bigint; costCents: number }[];
}> {
  const db = getDb();
  const [wallet] = await db.select().from(wallets).where(eq(wallets.userId, userId));
  if (!wallet) throw new Error("Wallet not found");

  const rows = await db.select().from(positions).where(eq(positions.userId, userId));
  return {
    cashCents: wallet.cashCents,
    startedAt: wallet.startedAt,
    positions: rows.map((row) => ({
      pair: row.pair,
      quantity: parseDecimal(row.quantity, QTY_SCALE)!,
      costCents: row.costCents,
    })),
  };
}

export async function listTrades(userId: number, limit = 100): Promise<Trade[]> {
  const rows = await getDb()
    .select()
    .from(trades)
    .where(eq(trades.userId, userId))
    .orderBy(desc(trades.createdAt), desc(trades.id))
    .limit(limit);
  return rows.map(toTrade);
}

export async function resetWallet(userId: number): Promise<void> {
  await getDb().transaction(async (tx) => {
    const [wallet] = await tx
      .select({ userId: wallets.userId })
      .from(wallets)
      .where(eq(wallets.userId, userId))
      .for("update");
    if (!wallet) throw new Error("Wallet not found");

    await tx.delete(trades).where(eq(trades.userId, userId));
    await tx.delete(positions).where(eq(positions.userId, userId));
    await tx
      .update(wallets)
      .set({ cashCents: STARTING_CASH_CENTS, startedAt: new Date() })
      .where(eq(wallets.userId, userId));
  });
}
