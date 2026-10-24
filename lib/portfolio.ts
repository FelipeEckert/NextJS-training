// Pure valuation: no database, no Next.js. Money in cents, quantities as bigint with QTY_SCALE decimals.
import { returnPct as percentReturn, toCents } from "./money";

export type Position = { pair: string; quantity: bigint; costCents: number };

export function valuePortfolio(
  cashCents: number,
  positions: Position[],
  bids: Map<string, bigint>, // a pair missing here has no price right now
): {
  rows: (Position & { valueCents: number | null; plCents: number | null; plPct: number | null })[];
  totalCents: number | null;
  returnPct: number | null;
} {
  const rows = positions.map((position) => {
    const bid = bids.get(position.pair);
    if (bid === undefined) return { ...position, valueCents: null, plCents: null, plPct: null };

    const valueCents = toCents(position.quantity, bid);
    const plCents = valueCents - position.costCents;
    const plPct = position.costCents > 0 ? (plCents / position.costCents) * 100 : null;
    return { ...position, valueCents, plCents, plPct };
  });

  // One unpriced row makes the total unknown, so the total never silently leaves a position out
  const priced = rows.every((row) => row.valueCents !== null);
  const totalCents = priced
    ? cashCents + rows.reduce((sum, row) => sum + (row.valueCents ?? 0), 0)
    : null;

  return {
    rows,
    totalCents,
    returnPct: totalCents === null ? null : percentReturn(totalCents),
  };
}
