import { describe, expect, it } from "vitest";
import {
  centsToBrl,
  formatDecimal,
  parseBrlToCents,
  parseDecimal,
  planTrade,
  returnPct,
  STARTING_CASH_CENTS,
} from "./money";

const quote = (bid: string, ask: string) => ({
  bid: parseDecimal(bid, 10)!,
  ask: parseDecimal(ask, 10)!,
});

const TWENTY_UNITS = 200000000000n;

describe("parseDecimal", () => {
  it("scales a plain decimal to fixed point", () => {
    expect(parseDecimal("5", 10)).toBe(50000000000n);
    expect(parseDecimal(" 10 ", 2)).toBe(1000n);
  });
  it("accepts leading zeros", () => {
    expect(parseDecimal("007", 0)).toBe(7n);
  });
  it("truncates decimals beyond the scale instead of rounding", () => {
    expect(parseDecimal("0.000000000001", 10)).toBe(0n);
  });
  it("rejects anything that is not a plain unsigned decimal", () => {
    for (const input of ["1e3", "-5", "", "10,50", ".", "1."]) {
      expect(parseDecimal(input, 10), input).toBeNull();
    }
  });
});

describe("formatDecimal", () => {
  it("drops trailing zeros", () => {
    expect(formatDecimal(15000000000n, 10)).toBe("1.5");
    expect(formatDecimal(200000000000n, 10)).toBe("20");
    expect(formatDecimal(0n, 10)).toBe("0");
  });
});

describe("parseBrlToCents", () => {
  it("converts reais to integer cents", () => {
    expect(parseBrlToCents("250")).toBe(25000);
    expect(parseBrlToCents("250.5")).toBe(25050);
  });
  it("rejects more than 2 decimals and non-dot separators", () => {
    expect(parseBrlToCents("10.555")).toBeNull();
    expect(parseBrlToCents("10,50")).toBeNull();
  });
});

describe("centsToBrl", () => {
  it("formats cents with 2 decimals", () => {
    expect(centsToBrl(123450)).toBe("1234.50");
    expect(centsToBrl(5)).toBe("0.05");
  });
});

describe("planTrade buy", () => {
  it("buys R$ 100 of a coin at ask 5 for 20 units", () => {
    const result = planTrade(
      { cashCents: STARTING_CASH_CENTS, holding: null },
      { side: "buy", brlCents: 10_000 },
      quote("4.9", "5"),
    );
    expect(result).toMatchObject({
      ok: true,
      quantity: TWENTY_UNITS,
      totalCents: 10_000,
      cashCents: 10_000_000 - 10_000,
      holding: { quantity: TWENTY_UNITS, costCents: 10_000 },
    });
  });

  it("rounds the bought quantity down", () => {
    const result = planTrade(
      { cashCents: STARTING_CASH_CENTS, holding: null },
      { side: "buy", brlCents: 100 },
      quote("599999", "600000"),
    );
    expect(result).toMatchObject({ ok: true, quantity: 16666n });
  });

  it("keeps full 10-decimal precision for large amounts", () => {
    const result = planTrade(
      { cashCents: STARTING_CASH_CENTS, holding: null },
      { side: "buy", brlCents: 10_000_000 },
      quote("0.0002", "0.0003"),
    );
    expect(result).toMatchObject({ ok: true, quantity: 3333333333333333333n });
  });

  it("rejects amounts below the minimum", () => {
    const result = planTrade(
      { cashCents: STARTING_CASH_CENTS, holding: null },
      { side: "buy", brlCents: 99 },
      quote("5", "5"),
    );
    expect(result).toMatchObject({ ok: false, code: "BELOW_MINIMUM" });
  });

  it("rejects amounts above the available cash", () => {
    const result = planTrade(
      { cashCents: STARTING_CASH_CENTS, holding: null },
      { side: "buy", brlCents: STARTING_CASH_CENTS + 1 },
      quote("5", "5"),
    );
    expect(result).toMatchObject({ ok: false, code: "INSUFFICIENT_CASH" });
  });
});

describe("planTrade sell", () => {
  it("rejects selling without a position", () => {
    const result = planTrade(
      { cashCents: 0, holding: null },
      { side: "sell", quantity: 1n },
      quote("5", "5"),
    );
    expect(result).toMatchObject({ ok: false, code: "NO_POSITION" });
  });

  it("rejects selling more than is held", () => {
    const result = planTrade(
      { cashCents: 0, holding: { quantity: TWENTY_UNITS, costCents: 10_000 } },
      { side: "sell", quantity: TWENTY_UNITS + 1n },
      quote("5", "5"),
    );
    expect(result).toMatchObject({ ok: false, code: "INSUFFICIENT_QUANTITY" });
  });

  it("rejects a sale worth 0 cents", () => {
    const result = planTrade(
      { cashCents: 0, holding: { quantity: TWENTY_UNITS, costCents: 10_000 } },
      { side: "sell", quantity: 1n },
      quote("5", "5"),
    );
    expect(result).toMatchObject({ ok: false, code: "AMOUNT_TOO_SMALL" });
  });

  it("reduces cost proportionally on a partial sale", () => {
    const result = planTrade(
      { cashCents: 0, holding: { quantity: TWENTY_UNITS, costCents: 10_000 } },
      { side: "sell", quantity: TWENTY_UNITS / 2n },
      quote("5", "5"),
    );
    expect(result).toMatchObject({
      ok: true,
      totalCents: 5_000,
      cashCents: 5_000,
      holding: { quantity: TWENTY_UNITS / 2n, costCents: 5_000 },
    });
  });

  it("clears the holding when selling everything", () => {
    const result = planTrade(
      { cashCents: 0, holding: { quantity: TWENTY_UNITS, costCents: 10_000 } },
      { side: "sell", quantity: "all" },
      quote("5", "5"),
    );
    expect(result).toMatchObject({ ok: true, holding: null, cashCents: 10_000 });
  });
});

describe("planTrade round trip", () => {
  it("never returns more cash than was spent", () => {
    const bought = planTrade(
      { cashCents: STARTING_CASH_CENTS, holding: null },
      { side: "buy", brlCents: 10_000 },
      quote("3", "3"),
    );
    if (!bought.ok) throw new Error("buy should succeed");
    const sold = planTrade(
      { cashCents: bought.cashCents, holding: bought.holding },
      { side: "sell", quantity: "all" },
      quote("3", "3"),
    );
    expect(sold).toMatchObject({ ok: true, totalCents: 9_999 });
  });
});

describe("returnPct", () => {
  it("computes the percentage change from the starting cash", () => {
    expect(returnPct(10_500_000)).toBe(5);
  });
});
