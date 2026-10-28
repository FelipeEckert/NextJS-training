import { describe, expect, it } from "vitest";

import { HOUSE_BOT_BUY_BRL, runHouseBot } from "./house-bot";
import { coinFlip, decideRandom } from "./random-bot";

const KEY = "ptk_test_key_1234567890abcdef";
const BASE = "https://example.test";
const PAIR = "USD-BRL";

const json = (body: unknown, status = 200) => Response.json(body, { status });

type Call = { method: string; path: string; body: unknown };

// A fake fetch: records every call and answers with the handler's response
function fakeFetch(handler: (method: string, path: string) => Response) {
  const calls: Call[] = [];
  const send = async (input: string | URL | Request, init: RequestInit = {}) => {
    const url = new URL(String(input));
    const method = init.method ?? "GET";
    calls.push({
      method,
      path: url.pathname,
      body: typeof init.body === "string" ? JSON.parse(init.body) : undefined,
    });
    return handler(method, url.pathname);
  };
  return { send: send as typeof fetch, calls };
}

// Factories, not constants: a Response body can be read only once
const walletEmpty = () => json({ data: { positions: [] } });
const risingHistory = () =>
  json({ data: Array.from({ length: 20 }, (_, i) => ({ date: "2026-10-01", close: 5 + i * 0.01 })) });
const trade = () =>
  json({ data: { side: "buy", quantity: "2000.0000000000", price: "5.0000", total: "10000.00" } }, 201);

// Consecutive UTC days from 2024-01-01
const day = (n: number) => new Date(Date.UTC(2024, 0, 1 + n));
const isoDay = (now: Date) => now.toISOString().slice(0, 10);

// The first day in the range where USD-BRL's coin lands on the given side
function dayWhere(heads: boolean): Date {
  for (let n = 0; n < 1000; n++) {
    if (coinFlip(`${isoDay(day(n))}-${PAIR}`) === heads) return day(n);
  }
  throw new Error(`no ${heads ? "heads" : "tails"} day in range`);
}

describe("coinFlip", () => {
  it("returns the same value for the same seed", () => {
    expect(coinFlip("2024-01-01-USD-BRL")).toBe(coinFlip("2024-01-01-USD-BRL"));
  });

  it("is heads about half the time over 1000 days", () => {
    const heads = Array.from({ length: 1000 }, (_, n) =>
      coinFlip(`${isoDay(day(n))}-${PAIR}`),
    ).filter(Boolean).length;
    expect(heads).toBeGreaterThanOrEqual(450);
    expect(heads).toBeLessThanOrEqual(550);
  });
});

describe("decideRandom", () => {
  const heads = dayWhere(true);
  const tails = dayWhere(false);

  it("buys on heads when not holding", () => {
    expect(decideRandom({ holding: false, pair: PAIR, now: heads })).toBe("buy");
  });

  it("sells on heads when holding", () => {
    expect(decideRandom({ holding: true, pair: PAIR, now: heads })).toBe("sell");
  });

  it("holds on tails, holding or not", () => {
    expect(decideRandom({ holding: false, pair: PAIR, now: tails })).toBe("hold");
    expect(decideRandom({ holding: true, pair: PAIR, now: tails })).toBe("hold");
  });
});

describe("runHouseBot with decideRandom", () => {
  it("buys USD-BRL on a heads day with an empty wallet", async () => {
    const now = dayWhere(true);
    const { send, calls } = fakeFetch((method, path) => {
      if (path === "/api/v1/wallet") return walletEmpty();
      if (path.startsWith("/api/v1/history/")) return risingHistory();
      return trade();
    });

    await runHouseBot({ baseUrl: BASE, apiKey: KEY, now, fetch: send, decide: decideRandom });

    const order = calls.find(
      (call) => call.method === "POST" && (call.body as { pair?: string })?.pair === PAIR,
    );
    expect(order?.path).toBe("/api/v1/orders");
    expect(order?.body).toEqual({ pair: PAIR, side: "buy", brl: HOUSE_BOT_BUY_BRL });
  });
});
