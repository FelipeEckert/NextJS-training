import { z } from "zod";

// Pure math for price history. No Next.js imports, so it runs in plain Node tests.

export type PricePoint = { date: string; close: number }; // date = UTC YYYY-MM-DD

export type Range = "7D" | "1M" | "3M" | "1Y";
export const RANGES: Range[] = ["7D", "1M", "3M", "1Y"];
export const RANGE_DAYS: Record<Range, number> = { "7D": 7, "1M": 30, "3M": 90, "1Y": 365 };

export function parseRange(value: string | undefined): Range {
  return RANGES.find((r) => r === value) ?? "1M";
}

// Extra fields are allowed: zod's default object drops them instead of failing
const HistoryItem = z.object({ bid: z.string(), timestamp: z.string() });

export function parseHistory(json: unknown): PricePoint[] {
  if (!Array.isArray(json)) return [];

  const points: (PricePoint & { ts: number })[] = [];
  for (const item of json) {
    const result = HistoryItem.safeParse(item);
    if (!result.success) continue;

    const ts = Number(result.data.timestamp);
    const close = Number(result.data.bid);
    // A rate is never 0 or negative (this also rejects NaN), and an out-of-range timestamp
    // makes an invalid Date, which would make toISOString throw
    const d = new Date(ts * 1000);
    if (!(close > 0) || Number.isNaN(d.getTime())) continue;

    points.push({ date: d.toISOString().slice(0, 10), close, ts });
  }

  // The API sends newest first, but charts need oldest first
  return points.sort((a, b) => a.ts - b.ts).map(({ date, close }) => ({ date, close }));
}

export function sliceRange(points: PricePoint[], range: Range): PricePoint[] {
  if (points.length === 0) return [];
  // Count calendar days, not points: fiat has no weekend points, so 360 points would span ~14 months
  const last = points[points.length - 1];
  const cutoff = new Date(Date.parse(last.date) - RANGE_DAYS[range] * 86_400_000).toISOString().slice(0, 10);
  return points.filter((p) => p.date > cutoff);
}

export type Summary = {
  first: number;
  last: number;
  change: number;
  changePct: number;
  min: number;
  max: number;
  average: number;
  volatility: number;
};

export function summarize(points: PricePoint[]): Summary | null {
  if (points.length === 0) return null;

  const closes = points.map((p) => p.close);
  const first = closes[0];
  const last = closes[closes.length - 1];
  const change = last - first;

  const sum = closes.reduce((total, c) => total + c, 0);

  // Day-to-day percentage changes; there are none with fewer than 2 points
  const returns = closes.slice(1).map((c, i) => ((c - closes[i]) / closes[i]) * 100);
  let volatility = 0;
  if (returns.length > 0) {
    const meanReturn = returns.reduce((total, r) => total + r, 0) / returns.length;
    const variance = returns.reduce((total, r) => total + (r - meanReturn) ** 2, 0) / returns.length;
    volatility = Math.sqrt(variance);
  }

  return {
    first,
    last,
    change,
    changePct: (change / first) * 100,
    min: Math.min(...closes),
    max: Math.max(...closes),
    average: sum / closes.length,
    volatility,
  };
}
