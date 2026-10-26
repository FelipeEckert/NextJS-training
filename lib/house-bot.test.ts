import { describe, expect, it } from "vitest";

import {
  decide,
  HOUSE_BOT_BUY_BRL,
  type HouseBotResult,
  idempotencyKey,
  runHouseBot,
} from "./house-bot";

const KEY = "ptk_test_key_1234567890abcdef";
const BASE = "https://example.test";
const NOW = new Date("2026-10-25T23:59:59Z");

// Rising closes: the 5-day mean is above the 20-day mean
const RISING = Array.from({ length: 20 }, (_, i) => 5 + i * 0.01);
const FALLING = Array.from({ length: 20 }, (_, i) => 5 - i * 0.01);

const json = (body: unknown, status = 200) => Response.json(body, { status });
const apiError = (status: number, code: string, message: string) =>
  json({ error: { code, message } }, status);

type Call = { method: string; path: string; headers: Headers; body: unknown };

// A fake fetch: records every call and answers with the handler's response
function fakeFetch(handler: (method: string, path: string) => Response) {
  const calls: Call[] = [];
  const send = async (input: string | URL | Request, init: RequestInit = {}) => {
    const url = new URL(String(input));
    const method = init.method ?? "GET";
    calls.push({
      method,
      path: url.pathname,
      headers: new Headers(init.headers),
      body: typeof init.body === "string" ? JSON.parse(init.body) : undefined,
    });
    return handler(method, url.pathname);
  };
  return { send: send as typeof fetch, calls };
}

// Factories, not constants: a Response body can be read only once
const walletEmpty = () => json({ data: { positions: [] } });
const risingHistory = () => json({ data: RISING.map((close) => ({ date: "2026-10-01", close })) });
const trade = () =>
  json(
    {
      data: {
        side: "buy",
        quantity: "2000.0000000000",
        price: "5.0000",
        total: "10000.00",
      },
    },
    201,
  );

function run(send: typeof fetch) {
  return runHouseBot({ baseUrl: BASE, apiKey: KEY, now: NOW, fetch: send });
}

describe("decide", () => {
  it("holds with fewer than 20 closes", () => {
    expect(decide(RISING.slice(0, 19), false)).toBe("hold");
  });

  it("buys a rising series when not holding", () => {
    expect(decide(RISING, false)).toBe("buy");
  });

  it("holds a rising series when already holding", () => {
    expect(decide(RISING, true)).toBe("hold");
  });

  it("sells a falling series when holding", () => {
    expect(decide(FALLING, true)).toBe("sell");
  });

  it("holds a falling series when not holding", () => {
    expect(decide(FALLING, false)).toBe("hold");
  });
});

describe("idempotencyKey", () => {
  it("uses the UTC date and the pair", () => {
    expect(idempotencyKey("USD-BRL", new Date("2026-10-25T23:59:59Z"))).toBe(
      "house-bot-2026-10-25-USD-BRL",
    );
  });
});

describe("runHouseBot", () => {
  it("buys with the right body, key and header, and reports the trade", async () => {
    const { send, calls } = fakeFetch((method, path) => {
      if (path === "/api/v1/wallet") return walletEmpty();
      if (path.startsWith("/api/v1/history/")) return risingHistory();
      return trade();
    });

    const results = await run(send);

    const buy = calls.find((call) => call.method === "POST" && call.path === "/api/v1/orders");
    expect(buy?.body).toEqual({ pair: "USD-BRL", side: "buy", brl: HOUSE_BOT_BUY_BRL });
    expect(buy?.headers.get("Idempotency-Key")).toBe("house-bot-2026-10-25-USD-BRL");
    expect(buy?.headers.get("Content-Type")).toBe("application/json");
    expect(buy?.headers.get("Authorization")).toBe(`Bearer ${KEY}`);
    expect(results[0]).toEqual({
      pair: "USD-BRL",
      action: "buy",
      detail: "buy 2000.0000000000 at 5.0000, total 10000.00",
    });
    expect(JSON.stringify(results)).not.toContain(KEY);
  });

  it("reports an error for one pair and still runs the next", async () => {
    const { send } = fakeFetch((method, path) => {
      if (path === "/api/v1/wallet") return walletEmpty();
      if (path === "/api/v1/history/USD-BRL") {
        return apiError(503, "PRICE_UNAVAILABLE", "Prices are unavailable right now.");
      }
      if (path.startsWith("/api/v1/history/")) return risingHistory();
      return trade();
    });

    const results = await run(send);

    expect(results[0]).toEqual({
      pair: "USD-BRL",
      action: "error",
      detail: "503 PRICE_UNAVAILABLE: Prices are unavailable right now.",
    });
    expect(results[1].pair).toBe("EUR-BRL");
    expect(results[1].action).toBe("buy");
  });

  it("trades nothing when the wallet request fails", async () => {
    const { send, calls } = fakeFetch(() =>
      apiError(401, "UNAUTHORIZED", "Missing or invalid API key."),
    );

    const results: HouseBotResult[] = await run(send);

    expect(results).toHaveLength(4);
    expect(results.every((result) => result.action === "error")).toBe(true);
    expect(results[0].detail).toBe("401 UNAUTHORIZED: Missing or invalid API key.");
    expect(calls.some((call) => call.method === "POST")).toBe(false);
    expect(JSON.stringify(results)).not.toContain(KEY);
  });
});
