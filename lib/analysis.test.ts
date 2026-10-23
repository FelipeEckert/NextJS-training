import { describe, expect, it } from "vitest";
import { parseHistory, parseRange, sliceRange, summarize, type PricePoint } from "./analysis";

const pts = (closes: number[]): PricePoint[] =>
  closes.map((close, i) => ({ date: `2026-01-${String(i + 1).padStart(2, "0")}`, close }));

describe("parseHistory", () => {
  it("converts newest-first API items into oldest-first points", () => {
    const json = [
      { bid: "4.994", timestamp: "1792784356", code: "USD" },
      { bid: "5.0523", timestamp: "1792708204" },
      { bid: "5.0236", timestamp: "1792621806" },
    ];
    expect(parseHistory(json)).toEqual([
      { date: "2026-10-21", close: 5.0236 },
      { date: "2026-10-22", close: 5.0523 },
      { date: "2026-10-23", close: 4.994 },
    ]);
  });
  it("drops invalid items", () => {
    const json = [{ bid: "abc", timestamp: "1792784356" }, { timestamp: "1792708204" }, { bid: "5.1", timestamp: "1792621806" }];
    expect(parseHistory(json)).toEqual([{ date: "2026-10-21", close: 5.1 }]);
  });
  it("drops empty and zero prices so stats never see Infinity or NaN", () => {
    const json = [{ bid: "", timestamp: "1792784356" }, { bid: "0", timestamp: "1792708204" }, { bid: "5.1", timestamp: "1792621806" }];
    expect(parseHistory(json)).toEqual([{ date: "2026-10-21", close: 5.1 }]);
  });
  it("returns [] for anything that isn't an array", () => {
    expect(parseHistory({ status: 404 })).toEqual([]);
    expect(parseHistory([])).toEqual([]);
  });
});

describe("parseRange", () => {
  it("accepts known ranges and defaults everything else to 1M", () => {
    expect(parseRange("1Y")).toBe("1Y");
    expect(parseRange("abc")).toBe("1M");
    expect(parseRange(undefined)).toBe("1M");
  });
});

describe("sliceRange", () => {
  it("keeps the most recent points for the range", () => {
    const ten = pts([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    expect(sliceRange(ten, "7D").map((p) => p.close)).toEqual([4, 5, 6, 7, 8, 9, 10]);
    expect(sliceRange(ten, "1M")).toHaveLength(10); // fewer points than the range: keep all
  });
});

describe("summarize", () => {
  it("computes change, min, max, average and volatility", () => {
    const s = summarize(pts([10, 11, 9.9, 12]))!;
    expect(s.first).toBe(10);
    expect(s.last).toBe(12);
    expect(s.change).toBeCloseTo(2);
    expect(s.changePct).toBeCloseTo(20);
    expect(s.min).toBe(9.9);
    expect(s.max).toBe(12);
    expect(s.average).toBeCloseTo(10.725);
    expect(s.volatility).toBeCloseTo(12.9095, 3);
  });
  it("handles a single point", () => {
    expect(summarize(pts([5]))).toMatchObject({ change: 0, changePct: 0, volatility: 0, min: 5, max: 5 });
  });
  it("returns null for no points", () => {
    expect(summarize([])).toBeNull();
  });
});
