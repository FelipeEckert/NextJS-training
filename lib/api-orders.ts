import { z } from "zod";

import { centsToBrl, formatDecimal, QTY_SCALE } from "./money";
import type { Trade } from "./trading";

// Amounts stay strings so the exact decimals reach money.ts parsers unchanged
// strict: a body mixing buy and sell fields, or with unknown keys, is rejected
export const OrderBodySchema = z.discriminatedUnion("side", [
  z.strictObject({ pair: z.string().max(20), side: z.literal("buy"), brl: z.string().max(40) }),
  z.strictObject({
    pair: z.string().max(20),
    side: z.literal("sell"),
    quantity: z.string().max(40),
  }),
]);

// Query string value: a number is required, so the caller handles the absent case
export const LimitSchema = z.coerce.number().int().min(1).max(100);

// Cost per whole unit with QTY_SCALE decimals, rounded down; quantity is itself scaled by 10^QTY_SCALE
export function averageCost(costCents: number, quantity: bigint): string {
  if (quantity === 0n) return "0";
  return formatDecimal((BigInt(costCents) * 10n ** BigInt(2 * QTY_SCALE)) / (100n * quantity), QTY_SCALE);
}

export function tradeToJson(trade: Trade) {
  return {
    id: trade.id,
    pair: trade.pair,
    side: trade.side,
    quantity: formatDecimal(trade.quantity, QTY_SCALE),
    price: formatDecimal(trade.price, QTY_SCALE),
    total: centsToBrl(trade.totalCents),
    createdAt: trade.createdAt.toISOString(),
  };
}
