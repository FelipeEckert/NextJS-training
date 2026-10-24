import { describe, expect, it } from "vitest";
import { portfolioHistory } from "./portfolio-history";

const STARTING = 10_000_000;
const ONE_UNIT = 10_000_000_000n;

describe("portfolioHistory", () => {
  it("values a buy at the latest close on or before each day", () => {
    const points = portfolioHistory({
      startDate: "2026-01-01",
      startingCashCents: STARTING,
      trades: [{ date: "2026-01-02", pair: "USD-BRL", side: "buy", quantity: ONE_UNIT, totalCents: 500 }],
      prices: {
        "USD-BRL": [
          { date: "2026-01-01", close: 5 },
          { date: "2026-01-03", close: 6 },
        ],
      },
      today: "2026-01-03",
    });
    expect(points).toEqual([
      { date: "2026-01-01", close: 100000 },
      { date: "2026-01-02", close: 100000 },
      { date: "2026-01-03", close: 100001 },
    ]);
  });

  it("holds cash flat for one point per day when there are no trades", () => {
    const points = portfolioHistory({
      startDate: "2026-01-01",
      startingCashCents: STARTING,
      trades: [],
      prices: {},
      today: "2026-01-03",
    });
    expect(points).toEqual([
      { date: "2026-01-01", close: 100000 },
      { date: "2026-01-02", close: 100000 },
      { date: "2026-01-03", close: 100000 },
    ]);
  });

  it("emits exactly one point when the wallet started today", () => {
    const points = portfolioHistory({
      startDate: "2026-01-03",
      startingCashCents: STARTING,
      trades: [],
      prices: {},
      today: "2026-01-03",
    });
    expect(points).toEqual([{ date: "2026-01-03", close: 100000 }]);
  });

  it("starts at most 365 days back", () => {
    const points = portfolioHistory({
      startDate: "2024-01-01",
      startingCashCents: STARTING,
      trades: [],
      prices: {},
      today: "2026-01-03",
    });
    expect(points).toHaveLength(366);
    expect(points[0].date).toBe("2025-01-03");
    expect(points[365].date).toBe("2026-01-03");
  });

  it("values a holding at zero when its pair has no closes", () => {
    const points = portfolioHistory({
      startDate: "2026-01-01",
      startingCashCents: STARTING,
      trades: [{ date: "2026-01-01", pair: "USD-BRL", side: "buy", quantity: ONE_UNIT, totalCents: 500 }],
      prices: {},
      today: "2026-01-01",
    });
    expect(points).toEqual([{ date: "2026-01-01", close: 99995 }]);
  });

  it("uses the first close for days before the pair's first close", () => {
    const points = portfolioHistory({
      startDate: "2026-01-01",
      startingCashCents: STARTING,
      trades: [{ date: "2026-01-01", pair: "USD-BRL", side: "buy", quantity: ONE_UNIT, totalCents: 500 }],
      prices: { "USD-BRL": [{ date: "2026-01-02", close: 6 }] },
      today: "2026-01-02",
    });
    expect(points).toEqual([
      { date: "2026-01-01", close: 100001 },
      { date: "2026-01-02", close: 100001 },
    ]);
  });
});
