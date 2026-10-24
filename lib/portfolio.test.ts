import { describe, expect, it } from "vitest";
import { parseDecimal, QTY_SCALE, returnPct, STARTING_CASH_CENTS } from "./money";
import { valuePortfolio } from "./portfolio";

const TWENTY_UNITS = 200000000000n;

describe("valuePortfolio", () => {
  it("values a position at its bid and computes P/L", () => {
    const result = valuePortfolio(
      5000,
      [{ pair: "USD-BRL", quantity: TWENTY_UNITS, costCents: 10000 }],
      new Map([["USD-BRL", parseDecimal("6", QTY_SCALE)!]]),
    );

    expect(result.rows).toEqual([
      {
        pair: "USD-BRL",
        quantity: TWENTY_UNITS,
        costCents: 10000,
        valueCents: 12000,
        plCents: 2000,
        plPct: 20,
      },
    ]);
    expect(result.totalCents).toBe(5000 + 12000);
    expect(result.returnPct).toBe(returnPct(17000));
  });

  it("leaves a row and the total empty when its bid is missing", () => {
    const result = valuePortfolio(
      5000,
      [{ pair: "USD-BRL", quantity: TWENTY_UNITS, costCents: 10000 }],
      new Map(),
    );

    expect(result.rows[0]).toEqual({
      pair: "USD-BRL",
      quantity: TWENTY_UNITS,
      costCents: 10000,
      valueCents: null,
      plCents: null,
      plPct: null,
    });
    expect(result.totalCents).toBeNull();
    expect(result.returnPct).toBeNull();
  });

  it("with no positions, the total is the cash and the return comes from it", () => {
    const result = valuePortfolio(STARTING_CASH_CENTS, [], new Map());

    expect(result).toEqual({
      rows: [],
      totalCents: STARTING_CASH_CENTS,
      returnPct: returnPct(STARTING_CASH_CENTS),
    });
  });
});
