"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { PairSchema } from "@/lib/favorites";
import { formatBRL } from "@/lib/format";
import { findCurrency } from "@/lib/currencies";
import { formatDecimal, parseBrlToCents, parseDecimal, QTY_SCALE } from "@/lib/money";
import { getTradeQuote } from "@/lib/quotes";
import { getCurrentUser } from "@/lib/session";
import { executeTrade, resetWallet, type Order, type Trade } from "@/lib/trading";

const TradeInput = z.object({
  pair: PairSchema,
  side: z.enum(["buy", "sell"]),
  amount: z.string().max(40).optional(),
  all: z.literal("on").optional(), // the "Sell all" checkbox sends "on" when checked
  idempotencyKey: z.uuid(),
});

export type TradeState = { ok: boolean; message: string } | null;

const INVALID_AMOUNT = "Enter a valid amount.";

export async function trade(_prev: TradeState, formData: FormData): Promise<TradeState> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, message: "Sign in to trade." };

  const parsed = TradeInput.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, message: INVALID_AMOUNT };
  const { pair, side, amount, all, idempotencyKey } = parsed.data;

  let order: Order;
  if (side === "buy") {
    const brlCents = parseBrlToCents(amount ?? "");
    if (brlCents === null) return { ok: false, message: INVALID_AMOUNT };
    order = { pair, side, brlCents };
  } else if (all === "on") {
    order = { pair, side, quantity: "all" };
  } else {
    const quantity = parseDecimal(amount ?? "", QTY_SCALE);
    if (quantity === null) return { ok: false, message: INVALID_AMOUNT };
    order = { pair, side, quantity };
  }

  const quote = await getTradeQuote(pair);
  if (!quote) {
    return { ok: false, message: "Price unavailable right now. Try again in a few seconds." };
  }

  const result = await executeTrade(user.id, order, quote, idempotencyKey);
  if (!result.ok) return { ok: false, message: result.message };

  refresh(); // re-render the balance and holdings shown on the page
  return { ok: true, message: describeTrade(pair, result.trade) };
}

export async function resetWalletAction(): Promise<void> {
  const user = await getCurrentUser();
  if (!user) return;

  await resetWallet(user.id);
  refresh(); // re-render the wallet with the fresh cash and no positions
}

function describeTrade(pair: string, trade: Trade) {
  const code = findCurrency(pair)!.code;
  const verb = trade.side === "buy" ? "Bought" : "Sold";
  const quantity = formatDecimal(trade.quantity, QTY_SCALE);
  const total = formatBRL(trade.totalCents / 100); // display only, never used for money math
  // Every decimal of the fill price: the spec asks for the exact price used, and pairs like BTC or KRW need more than cents
  const price = `R$${formatDecimal(trade.price, QTY_SCALE)}`;
  const time = trade.createdAt.toLocaleTimeString("en-US", {
    timeZone: "America/Sao_Paulo",
    hour12: false,
  });
  return `${verb} ${quantity} ${code} for ${total} at ${price} (${time} Brasília time).`;
}
