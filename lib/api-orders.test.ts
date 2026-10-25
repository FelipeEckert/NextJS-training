import { describe, expect, it } from "vitest";

import { LimitSchema, OrderBodySchema, tradeToJson } from "./api-orders";

describe("OrderBodySchema", () => {
  it("accepts a buy with brl as a string", () => {
    expect(OrderBodySchema.safeParse({ pair: "USD-BRL", side: "buy", brl: "100.50" }).success).toBe(
      true,
    );
  });

  it("accepts a sell with a quantity or 'all'", () => {
    expect(
      OrderBodySchema.safeParse({ pair: "USD-BRL", side: "sell", quantity: "2" }).success,
    ).toBe(true);
    expect(
      OrderBodySchema.safeParse({ pair: "USD-BRL", side: "sell", quantity: "all" }).success,
    ).toBe(true);
  });

  it("rejects an unknown side", () => {
    expect(OrderBodySchema.safeParse({ pair: "USD-BRL", side: "short", brl: "1" }).success).toBe(
      false,
    );
  });

  it("rejects a numeric brl", () => {
    expect(OrderBodySchema.safeParse({ pair: "USD-BRL", side: "buy", brl: 100 }).success).toBe(
      false,
    );
  });

  it("rejects missing fields", () => {
    expect(OrderBodySchema.safeParse({ side: "buy", brl: "100" }).success).toBe(false);
    expect(OrderBodySchema.safeParse({ pair: "USD-BRL", side: "sell" }).success).toBe(false);
  });

  it("rejects a brl longer than 40 characters", () => {
    expect(
      OrderBodySchema.safeParse({ pair: "USD-BRL", side: "buy", brl: "1".repeat(41) }).success,
    ).toBe(false);
  });

  it("rejects a pair longer than 20 characters", () => {
    expect(
      OrderBodySchema.safeParse({ pair: "A".repeat(21), side: "buy", brl: "1" }).success,
    ).toBe(false);
  });

  it("rejects a quantity longer than 40 characters", () => {
    expect(
      OrderBodySchema.safeParse({ pair: "USD-BRL", side: "sell", quantity: "1".repeat(41) })
        .success,
    ).toBe(false);
  });

  it("rejects a body with an extra key", () => {
    expect(
      OrderBodySchema.safeParse({ pair: "USD-BRL", side: "buy", brl: "1", extra: true }).success,
    ).toBe(false);
  });

  it("rejects a body mixing buy and sell fields", () => {
    expect(
      OrderBodySchema.safeParse({ pair: "USD-BRL", side: "buy", brl: "10", quantity: "all" })
        .success,
    ).toBe(false);
  });
});

describe("LimitSchema", () => {
  it("accepts integers from 1 to 100", () => {
    expect(LimitSchema.safeParse("1").success).toBe(true);
    expect(LimitSchema.safeParse("100").success).toBe(true);
  });

  it("rejects 0, 101, decimals and non-numbers", () => {
    for (const value of ["0", "101", "1.5", "abc", ""]) {
      expect(LimitSchema.safeParse(value).success).toBe(false);
    }
  });
});

describe("tradeToJson", () => {
  it("formats quantity, price, total and createdAt", () => {
    const json = tradeToJson({
      id: 7,
      pair: "USD-BRL",
      side: "buy",
      quantity: 200000000000n,
      price: 50000000000n,
      totalCents: 10000,
      createdAt: new Date("2026-10-25T12:00:00.000Z"),
    });
    expect(json).toEqual({
      id: 7,
      pair: "USD-BRL",
      side: "buy",
      quantity: "20",
      price: "5",
      total: "100.00",
      createdAt: "2026-10-25T12:00:00.000Z",
    });
  });
});
