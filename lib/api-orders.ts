import { z } from "zod";

import { centsToBrl, formatDecimal, QTY_SCALE } from "./money";
import type { Trade } from "./trading";

// Amounts stay strings so the exact decimals reach money.ts parsers unchanged
export const OrderBodySchema = z.discriminatedUnion("side", [
  z.object({ pair: z.string().max(20), side: z.literal("buy"), brl: z.string().max(40) }),
  z.object({
    pair: z.string().max(20),
    side: z.literal("sell"),
    quantity: z.union([z.literal("all"), z.string().max(40)]),
  }),
]);

// Query string value: a number is required, so the caller handles the absent case
export const LimitSchema = z.coerce.number().int().min(1).max(100);

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
