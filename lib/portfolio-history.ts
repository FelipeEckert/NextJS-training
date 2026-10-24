import type { PricePoint } from "./analysis";
import { parseDecimal, QTY_SCALE, toCents } from "./money";

export type PortfolioTrade = {
  date: string; // UTC YYYY-MM-DD
  pair: string;
  side: "buy" | "sell";
  quantity: bigint;
  totalCents: number;
};

type Close = { date: string; price: bigint };

// Wallet value per day, replayed from the trades. Trades ascending; closes oldest first.
export function portfolioHistory(input: {
  startDate: string;
  startingCashCents: number;
  trades: PortfolioTrade[];
  prices: Record<string, PricePoint[]>;
  today: string;
}): PricePoint[] {
  const { startingCashCents, trades, today } = input;

  const closesByPair = new Map<string, Close[]>();
  for (const [pair, history] of Object.entries(input.prices)) {
    const closes: Close[] = [];
    for (const point of history) {
      // toFixed avoids exponent notation such as "1e-7", which parseDecimal rejects
      const price = parseDecimal(point.close.toFixed(QTY_SCALE), QTY_SCALE);
      if (price !== null) closes.push({ date: point.date, price });
    }
    closesByPair.set(pair, closes);
  }

  const windowStart = addDays(today, -365);
  const first = input.startDate > windowStart ? input.startDate : windowStart;
  const quantities = new Map<string, bigint>();
  const points: PricePoint[] = [];
  let cash = startingCashCents;
  let next = 0;

  for (let day = first; day <= today; day = addDays(day, 1)) {
    // Trades dated on or before the day all count, including those before the first point
    for (; next < trades.length && trades[next].date <= day; next++) {
      const trade = trades[next];
      const held = quantities.get(trade.pair) ?? 0n;
      if (trade.side === "buy") {
        cash -= trade.totalCents;
        quantities.set(trade.pair, held + trade.quantity);
      } else {
        cash += trade.totalCents;
        quantities.set(trade.pair, held - trade.quantity);
      }
    }

    let value = cash;
    for (const [pair, quantity] of quantities) {
      const price = priceOn(closesByPair.get(pair) ?? [], day);
      if (price !== null) value += toCents(quantity, price);
    }
    points.push({ date: day, close: value / 100 });
  }
  return points;
}

// Latest close on or before the day; before the first close, the first one
function priceOn(closes: Close[], day: string): bigint | null {
  if (closes.length === 0) return null;
  let price = closes[0].price;
  for (const close of closes) {
    if (close.date > day) break;
    price = close.price;
  }
  return price;
}

function addDays(date: string, days: number): string {
  const [year, month, day] = date.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10);
}
