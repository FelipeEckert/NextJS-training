// Quantities and prices are bigint with QTY_SCALE decimals; BRL is integer cents. No floats in money math.

export const QTY_SCALE = 10;
export const STARTING_CASH_CENTS = 10_000_000;
export const MIN_BUY_CENTS = 100;

export type Holding = { quantity: bigint; costCents: number };

export type PlanOrder =
  | { side: "buy"; brlCents: number }
  | { side: "sell"; quantity: bigint | "all" };

export type TradeErrorCode =
  | "BELOW_MINIMUM"
  | "INSUFFICIENT_CASH"
  | "NO_POSITION"
  | "INSUFFICIENT_QUANTITY"
  | "AMOUNT_TOO_SMALL";

export type TradePlan =
  | {
      ok: true;
      quantity: bigint;
      price: bigint;
      totalCents: number;
      cashCents: number;
      holding: Holding | null;
    }
  | { ok: false; code: TradeErrorCode; message: string };

const ERROR_MESSAGES: Record<TradeErrorCode, string> = {
  BELOW_MINIMUM: "The minimum order is R$ 1.00.",
  INSUFFICIENT_CASH: "You do not have enough cash for this order.",
  NO_POSITION: "You do not hold this currency.",
  INSUFFICIENT_QUANTITY: "You do not hold that much.",
  AMOUNT_TOO_SMALL: "The amount is too small to trade.",
};

function fail(code: TradeErrorCode): TradePlan {
  return { ok: false, code, message: ERROR_MESSAGES[code] };
}

// Extra decimals are truncated, never rounded up.
export function parseDecimal(input: string, scale: number): bigint | null {
  const trimmed = input.trim();
  if (!/^\d+(\.\d+)?$/.test(trimmed)) return null;
  const [whole, fraction = ""] = trimmed.split(".");
  return BigInt(whole + fraction.slice(0, scale).padEnd(scale, "0"));
}

export function formatDecimal(value: bigint, scale: number): string {
  const digits = value.toString().padStart(scale + 1, "0");
  const whole = digits.slice(0, digits.length - scale);
  const fraction = digits.slice(digits.length - scale).replace(/0+$/, "");
  return fraction ? `${whole}.${fraction}` : whole;
}

export function parseBrlToCents(input: string): number | null {
  const trimmed = input.trim();
  if (!/^\d+(\.\d{1,2})?$/.test(trimmed)) return null;
  return Number(parseDecimal(trimmed, 2));
}

export function centsToBrl(cents: number): string {
  const value = BigInt(cents);
  return `${value / 100n}.${(value % 100n).toString().padStart(2, "0")}`;
}

// Rounds down, so the house keeps any fraction of a cent.
export function toCents(quantity: bigint, price: bigint): number {
  return Number((quantity * price) / 10n ** 18n);
}

export function planTrade(
  state: { cashCents: number; holding: Holding | null },
  order: PlanOrder,
  quote: { bid: bigint; ask: bigint },
): TradePlan {
  if (order.side === "buy") {
    if (order.brlCents < MIN_BUY_CENTS) return fail("BELOW_MINIMUM");
    if (order.brlCents > state.cashCents) return fail("INSUFFICIENT_CASH");
    const quantity = (BigInt(order.brlCents) * 10n ** 18n) / quote.ask;
    if (quantity === 0n) return fail("AMOUNT_TOO_SMALL");
    return {
      ok: true,
      quantity,
      price: quote.ask,
      totalCents: order.brlCents,
      cashCents: state.cashCents - order.brlCents,
      holding: {
        quantity: (state.holding?.quantity ?? 0n) + quantity,
        costCents: (state.holding?.costCents ?? 0) + order.brlCents,
      },
    };
  }

  const held = state.holding;
  if (!held) return fail("NO_POSITION");
  const quantity = order.quantity === "all" ? held.quantity : order.quantity;
  if (quantity <= 0n) return fail("AMOUNT_TOO_SMALL");
  if (quantity > held.quantity) return fail("INSUFFICIENT_QUANTITY");
  const totalCents = toCents(quantity, quote.bid);
  if (totalCents === 0) return fail("AMOUNT_TOO_SMALL");

  const remaining = held.quantity - quantity;
  const base = {
    ok: true as const,
    quantity,
    price: quote.bid,
    totalCents,
    cashCents: state.cashCents + totalCents,
  };
  if (remaining === 0n) return { ...base, holding: null };
  const costSold = Number((BigInt(held.costCents) * quantity) / held.quantity);
  return {
    ...base,
    holding: { quantity: remaining, costCents: held.costCents - costSold },
  };
}

export function returnPct(totalCents: number): number {
  return ((totalCents - STARTING_CASH_CENTS) * 100) / STARTING_CASH_CENTS;
}
