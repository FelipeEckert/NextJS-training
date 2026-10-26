import { z } from "zod";
import type { PricePoint } from "./analysis";
import { PAIRS } from "./currencies";

// Pure simulation. Floats are fine here: nothing is stored or accumulated as money.

export type Strategy =
  | { kind: "hold" }
  | { kind: "dip"; dropPct: number; lookbackDays: number; takeProfitPct: number }
  | { kind: "ma"; shortDays: number; longDays: number };

export const STRATEGY_LABELS: Record<Strategy["kind"], string> = {
  hold: "Buy and hold",
  dip: "Buy the dip",
  ma: "Moving-average crossover",
};

export type BacktestResult = {
  equity: PricePoint[];
  finalValue: number;
  returnPct: number;
  trades: number;
  maxDrawdownPct: number;
};

// Indicators read the full history, so they can use points before fromDate
export function runBacktest(
  history: PricePoint[],
  strategy: Strategy,
  fromDate: string,
  startCash = 100_000,
): BacktestResult {
  const equity: PricePoint[] = [];
  let cash = startCash;
  let units = 0;
  let entry = 0;
  let trades = 0;
  let peak = 0;
  let maxDrawdownPct = 0;

  for (let i = 0; i < history.length; i++) {
    const { date, close } = history[i];
    if (date < fromDate) continue;

    // One decision per day from the current state: a flat portfolio can only buy, a holding one only sell
    if (units === 0) {
      if (wantsBuy(history, i, strategy)) {
        units = cash / close;
        cash = 0;
        entry = close;
        trades++;
      }
    } else if (wantsSell(history, i, strategy, entry)) {
      cash = units * close;
      units = 0;
      trades++;
    }

    const value = cash + units * close;
    equity.push({ date, close: value });
    peak = Math.max(peak, value);
    if (peak > 0) maxDrawdownPct = Math.max(maxDrawdownPct, ((peak - value) / peak) * 100);
  }

  const finalValue = equity.length > 0 ? equity[equity.length - 1].close : startCash;
  return {
    equity,
    finalValue,
    returnPct: ((finalValue - startCash) / startCash) * 100,
    trades,
    maxDrawdownPct,
  };
}

// Hold never sells, so it buys only on the first tradable point
function wantsBuy(history: PricePoint[], i: number, s: Strategy): boolean {
  switch (s.kind) {
    case "hold":
      return true;
    case "dip":
      return i - s.lookbackDays >= 0 && history[i].close <= history[i - s.lookbackDays].close * (1 - s.dropPct / 100);
    case "ma":
      return i >= s.longDays - 1 && sma(history, i, s.shortDays) > sma(history, i, s.longDays);
  }
}

function wantsSell(history: PricePoint[], i: number, s: Strategy, entry: number): boolean {
  switch (s.kind) {
    case "hold":
      return false;
    case "dip":
      return history[i].close >= entry * (1 + s.takeProfitPct / 100);
    case "ma":
      return sma(history, i, s.shortDays) < sma(history, i, s.longDays);
  }
}

// Average of the last `days` closes ending at index i
function sma(history: PricePoint[], i: number, days: number): number {
  let sum = 0;
  for (let k = i - days + 1; k <= i; k++) sum += history[k].close;
  return sum / days;
}

// The form pre-fills from these, so the page and the parser share one set of defaults
export const DEFAULTS: Record<string, string> = {
  pair: "USD-BRL",
  kind: "dip",
  dropPct: "2",
  lookbackDays: "5",
  takeProfitPct: "3",
  shortDays: "10",
  longDays: "30",
};

function range(field: string, min: number, max: number, whole = false) {
  const error = `${field} must be ${whole ? "a whole number " : ""}between ${min} and ${max}.`;
  const n = z.coerce.number({ error }).min(min, { error }).max(max, { error });
  return whole ? n.int({ error }) : n;
}

const Pair = z.string().refine((p) => PAIRS.includes(p), { error: "pair is not a supported currency." });
const Kind = z.enum(["hold", "dip", "ma"], { error: "kind must be hold, dip or ma." });
const Dip = z.object({
  dropPct: range("dropPct", 0.5, 50),
  lookbackDays: range("lookbackDays", 1, 60, true),
  takeProfitPct: range("takeProfitPct", 0.5, 100),
});
const Ma = z
  .object({ shortDays: range("shortDays", 2, 50, true), longDays: range("longDays", 5, 200, true) })
  .refine((d) => d.shortDays < d.longDays, { error: "shortDays must be less than longDays." });

const fail = (error: string) => ({ ok: false as const, error });

export function parseBacktestParams(
  sp: Record<string, string | string[] | undefined>,
): { ok: true; pair: string; strategy: Strategy } | { ok: false; error: string } {
  if (Object.values(sp).some((v) => Array.isArray(v))) return fail("Each setting can only appear once.");

  const given = Object.entries(sp).filter((e): e is [string, string] => typeof e[1] === "string");
  const raw = { ...DEFAULTS, ...Object.fromEntries(given) };

  const head = z.object({ pair: Pair, kind: Kind }).safeParse(raw);
  if (!head.success) return fail(head.error.issues[0].message);
  const { pair, kind } = head.data;

  if (kind === "hold") return { ok: true, pair, strategy: { kind } };

  if (kind === "dip") {
    const d = Dip.safeParse(raw);
    if (!d.success) return fail(d.error.issues[0].message);
    return { ok: true, pair, strategy: { kind, ...d.data } };
  }

  const m = Ma.safeParse(raw);
  if (!m.success) return fail(m.error.issues[0].message);
  return { ok: true, pair, strategy: { kind, ...m.data } };
}

// Compare runs all three strategies with the same settings; the order is the chart color order
export function parseCompareParams(
  sp: Record<string, string | string[] | undefined>,
): { ok: true; pair: string; strategies: Strategy[] } | { ok: false; error: string } {
  const dip = parseBacktestParams({ ...sp, kind: "dip" });
  if (!dip.ok) return dip;
  const ma = parseBacktestParams({ ...sp, kind: "ma" });
  if (!ma.ok) return ma;
  return { ok: true, pair: dip.pair, strategies: [{ kind: "hold" }, dip.strategy, ma.strategy] };
}
