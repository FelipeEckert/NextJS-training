import { describe, expect, it } from "vitest";
import { toTradeQuote } from "./trade-quote";
import type { Quote } from "./quotes";

const quote = (overrides: Partial<Quote> = {}): Quote => ({
  pair: "USD-BRL",
  currency: "US Dollar",
  price: 5.1234,
  change: 0.1,
  updatedAt: "2026-10-24 10:00:00",
  bid: "5.1234",
  ask: "5.1300",
  ...overrides,
});

const FETCHED_AT = 1_000_000;

describe("toTradeQuote", () => {
  it("converts a fresh quote to fixed-point bid and ask", () => {
    expect(toTradeQuote(quote(), FETCHED_AT, FETCHED_AT + 1_000)).toEqual({
      bid: 51234000000n,
      ask: 51300000000n,
      fetchedAt: FETCHED_AT,
    });
  });

  it("accepts a quote exactly 120 seconds old", () => {
    expect(toTradeQuote(quote(), FETCHED_AT, FETCHED_AT + 120_000)).not.toBeNull();
  });

  it("rejects a quote older than 120 seconds", () => {
    expect(toTradeQuote(quote(), FETCHED_AT, FETCHED_AT + 120_001)).toBeNull();
  });

  it("rejects a missing quote", () => {
    expect(toTradeQuote(undefined, FETCHED_AT, FETCHED_AT)).toBeNull();
  });

  it("rejects a zero bid", () => {
    expect(toTradeQuote(quote({ bid: "0" }), FETCHED_AT, FETCHED_AT)).toBeNull();
  });

  it("rejects an ask that does not parse", () => {
    expect(toTradeQuote(quote({ ask: "abc" }), FETCHED_AT, FETCHED_AT)).toBeNull();
  });
});
