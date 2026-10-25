import type { Quote } from "./quotes";
import { parseDecimal, QTY_SCALE } from "./money";

export type TradeQuote = { bid: bigint; ask: bigint; fetchedAt: number };

const MAX_QUOTE_AGE_MS = 120_000;

// Trades execute at these prices, so a stale or unparseable quote must never reach an order.
export function toTradeQuote(
  quote: Quote | undefined,
  fetchedAt: number,
  nowMs: number,
): TradeQuote | null {
  if (!quote) return null;
  if (nowMs - fetchedAt > MAX_QUOTE_AGE_MS) return null;

  const bid = parseDecimal(quote.bid, QTY_SCALE);
  const ask = parseDecimal(quote.ask, QTY_SCALE);
  if (bid === null || ask === null || bid <= 0n || ask <= 0n) return null;

  // Buying at the ask and selling at a higher bid would mint money
  if (ask < bid) return null;

  return { bid, ask, fetchedAt };
}
