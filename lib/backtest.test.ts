import { describe, expect, it } from "vitest";
import { parseBacktestParams, parseCompareParams, runBacktest } from "./backtest";
import type { PricePoint } from "./analysis";

const pts = (closes: number[]): PricePoint[] =>
  closes.map((close, i) => ({ date: new Date(Date.UTC(2026, 0, 1 + i)).toISOString().slice(0, 10), close }));

const FROM = "2026-01-01";

describe("runBacktest", () => {
  it("hold buys the first point and marks to market", () => {
    const r = runBacktest(pts([10, 9, 8, 9, 12]), { kind: "hold" }, FROM);
    expect(r.finalValue).toBeCloseTo(120000, 2);
    expect(r.returnPct).toBeCloseTo(20, 2);
    expect(r.trades).toBe(1);
    expect(r.maxDrawdownPct).toBeCloseTo(20, 2);
    expect(r.equity).toHaveLength(5);
    expect(r.equity[0]).toEqual({ date: "2026-01-01", close: expect.any(Number) });
  });

  it("dip buys after a drop and sells on take-profit", () => {
    const r = runBacktest(pts([10, 9, 8, 9, 12]), { kind: "dip", dropPct: 10, lookbackDays: 1, takeProfitPct: 20 }, FROM);
    expect(r.finalValue).toBeCloseTo(133333.33, 2);
    expect(r.returnPct).toBeCloseTo(33.33, 2);
    expect(r.trades).toBe(2);
    expect(r.maxDrawdownPct).toBeCloseTo(11.11, 2);
  });

  it("ma buys and sells on crossovers", () => {
    const r = runBacktest(pts([1, 2, 3, 2, 1, 2, 3]), { kind: "ma", shortDays: 2, longDays: 3 }, FROM);
    expect(r.finalValue).toBeCloseTo(33333.33, 2);
    expect(r.returnPct).toBeCloseTo(-66.67, 2);
    expect(r.trades).toBe(3);
  });

  it("trades only from fromDate, but the dip lookback reads earlier closes", () => {
    // fromDate is 2026-01-03: the buy at 8 compares against close 9 from 2026-01-02
    const r = runBacktest(pts([10, 9, 8, 9, 12]), { kind: "dip", dropPct: 10, lookbackDays: 1, takeProfitPct: 20 }, "2026-01-03");
    expect(r.equity.map((p) => p.date)).toEqual(["2026-01-03", "2026-01-04", "2026-01-05"]);
    expect(r.finalValue).toBeCloseTo(150000, 2);
    expect(r.returnPct).toBeCloseTo(50, 2);
    expect(r.trades).toBe(2);
  });

  it("returns the empty result when no point is on or after fromDate", () => {
    const r = runBacktest(pts([10, 9]), { kind: "hold" }, "2026-02-01");
    expect(r).toEqual({ equity: [], finalValue: 100000, returnPct: 0, trades: 0, maxDrawdownPct: 0 });
  });
});

describe("parseBacktestParams", () => {
  it("uses the defaults when nothing is given", () => {
    expect(parseBacktestParams({})).toEqual({
      ok: true,
      pair: "USD-BRL",
      strategy: { kind: "dip", dropPct: 2, lookbackDays: 5, takeProfitPct: 3 },
    });
  });

  it("parses a hold and an ma strategy from strings", () => {
    expect(parseBacktestParams({ pair: "EUR-BRL", kind: "hold" })).toEqual({
      ok: true,
      pair: "EUR-BRL",
      strategy: { kind: "hold" },
    });
    expect(parseBacktestParams({ kind: "ma", shortDays: "5", longDays: "20" })).toEqual({
      ok: true,
      pair: "USD-BRL",
      strategy: { kind: "ma", shortDays: 5, longDays: 20 },
    });
  });

  it("rejects shortDays that is not below longDays", () => {
    expect(parseBacktestParams({ kind: "ma", shortDays: "30", longDays: "30" }).ok).toBe(false);
    expect(parseBacktestParams({ kind: "ma", shortDays: "40", longDays: "30" }).ok).toBe(false);
  });

  it("rejects an unknown pair", () => {
    expect(parseBacktestParams({ pair: "XXX-BRL" }).ok).toBe(false);
  });

  it("rejects a non-numeric dropPct", () => {
    expect(parseBacktestParams({ dropPct: "abc" }).ok).toBe(false);
  });

  it("rejects a repeated parameter", () => {
    expect(parseBacktestParams({ dropPct: ["2", "3"] }).ok).toBe(false);
  });

  it("ignores fields that belong to another kind", () => {
    expect(parseBacktestParams({ kind: "ma", dropPct: "abc" }).ok).toBe(true);
  });

  it("requires whole numbers for day counts", () => {
    expect(parseBacktestParams({ lookbackDays: "2.5" }).ok).toBe(false);
  });
});

describe("parseCompareParams", () => {
  it("returns hold, dip and ma with the default settings, in color order", () => {
    expect(parseCompareParams({ kind: "compare" })).toEqual({
      ok: true,
      pair: "USD-BRL",
      strategies: [
        { kind: "hold" },
        { kind: "dip", dropPct: 2, lookbackDays: 5, takeProfitPct: 3 },
        { kind: "ma", shortDays: 10, longDays: 30 },
      ],
    });
  });

  it("reports a bad dip setting", () => {
    expect(parseCompareParams({ kind: "compare", dropPct: "-1" })).toEqual({
      ok: false,
      error: "dropPct must be between 0.5 and 50.",
    });
  });

  it("reports shortDays that is not below longDays", () => {
    expect(parseCompareParams({ kind: "compare", shortDays: "30", longDays: "30" })).toEqual({
      ok: false,
      error: "shortDays must be less than longDays.",
    });
  });

  it("rejects a repeated parameter", () => {
    expect(parseCompareParams({ kind: "compare", dropPct: ["2", "3"] })).toEqual({
      ok: false,
      error: "Each setting can only appear once.",
    });
  });

  it("gives each strategy the same result as running it on its own", () => {
    const sp = { kind: "compare", dropPct: "5", lookbackDays: "2", takeProfitPct: "4", shortDays: "2", longDays: "5" };
    const compare = parseCompareParams(sp);
    if (!compare.ok) throw new Error(compare.error);
    const history = pts([10, 9, 8, 9, 12, 11, 13, 12]);

    for (const strategy of compare.strategies) {
      const single = parseBacktestParams({ ...sp, kind: strategy.kind });
      if (!single.ok) throw new Error(single.error);
      expect(single.strategy).toEqual(strategy);
      expect(runBacktest(history, strategy, FROM)).toEqual(runBacktest(history, single.strategy, FROM));
    }
  });
});
