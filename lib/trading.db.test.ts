import { randomUUID } from "node:crypto";

import { afterAll, expect, it } from "vitest";

import { closeDb } from "./db";
import { parseDecimal, QTY_SCALE, STARTING_CASH_CENTS } from "./money";
import { executeTrade, getWallet, listTrades, resetWallet } from "./trading";
import { createUser } from "./users";

// Unique per test: the dev database is shared, and rows are never deleted
function newUsername() {
  return `t_${randomUUID().replaceAll("-", "").slice(0, 12)}`;
}

async function createTestUser() {
  const created = await createUser(newUsername(), "correct horse battery");
  if (!created.ok) throw new Error("test setup: username already taken");
  return created.user;
}

const flat = { bid: parseDecimal("5", QTY_SCALE)!, ask: parseDecimal("5", QTY_SCALE)! };
const spread = { bid: parseDecimal("5", QTY_SCALE)!, ask: parseDecimal("5.01", QTY_SCALE)! };

afterAll(closeDb);

it("lets only one of two simultaneous buys spend the same cash", async () => {
  const user = await createTestUser();
  const buy = { pair: "USD", side: "buy" as const, brlCents: 6_000_000 };

  const results = await Promise.all([
    executeTrade(user.id, buy, flat, randomUUID()),
    executeTrade(user.id, buy, flat, randomUUID()),
  ]);

  expect(results.filter((r) => r.ok)).toHaveLength(1);
  expect(results.find((r) => !r.ok)).toMatchObject({ ok: false, code: "INSUFFICIENT_CASH" });
  expect((await getWallet(user.id)).cashCents).toBe(4_000_000);
  expect(await listTrades(user.id)).toHaveLength(1);
});

it("replays a repeated key instead of trading twice", async () => {
  const user = await createTestUser();
  const buy = { pair: "USD", side: "buy" as const, brlCents: 10_000 };
  const key = randomUUID();

  const first = await executeTrade(user.id, buy, flat, key);
  const second = await executeTrade(user.id, buy, flat, key);

  if (!first.ok || !second.ok) throw new Error("expected both trades to succeed");
  expect(first.replayed).toBe(false);
  expect(second.replayed).toBe(true);
  expect(second.trade.id).toBe(first.trade.id);
  expect(await listTrades(user.id)).toHaveLength(1);
});

it("trades once when the same key arrives concurrently", async () => {
  const user = await createTestUser();
  const buy = { pair: "USD", side: "buy" as const, brlCents: 10_000 };
  const key = randomUUID();

  const results = await Promise.all([
    executeTrade(user.id, buy, flat, key),
    executeTrade(user.id, buy, flat, key),
  ]);

  expect(results.every((r) => r.ok)).toBe(true);
  expect(results.filter((r) => r.ok && r.replayed)).toHaveLength(1);
  expect(await listTrades(user.id)).toHaveLength(1);
  expect((await getWallet(user.id)).cashCents).toBe(STARTING_CASH_CENTS - 10_000);
});

it("rejects a reused key sent with a different amount", async () => {
  const user = await createTestUser();
  const key = randomUUID();

  await executeTrade(user.id, { pair: "USD", side: "buy", brlCents: 10_000 }, flat, key);
  const result = await executeTrade(
    user.id,
    { pair: "USD", side: "buy", brlCents: 20_000 },
    flat,
    key,
  );

  expect(result).toMatchObject({ ok: false, code: "IDEMPOTENCY_MISMATCH" });
});

it("removes the position when the whole holding is sold", async () => {
  const user = await createTestUser();

  const bought = await executeTrade(
    user.id,
    { pair: "USD", side: "buy", brlCents: 10_000 },
    spread,
    randomUUID(),
  );
  const sold = await executeTrade(
    user.id,
    { pair: "USD", side: "sell", quantity: "all" },
    spread,
    randomUUID(),
  );

  expect(bought.ok && sold.ok).toBe(true);
  const wallet = await getWallet(user.id);
  expect(wallet.positions).toEqual([]);
  expect(wallet.cashCents).toBeLessThan(STARTING_CASH_CENTS);
});

it("lists trades newest first, then resets the wallet", async () => {
  const user = await createTestUser();
  await executeTrade(user.id, { pair: "USD", side: "buy", brlCents: 10_000 }, flat, randomUUID());
  await executeTrade(user.id, { pair: "USD", side: "buy", brlCents: 20_000 }, flat, randomUUID());

  expect((await listTrades(user.id)).map((t) => t.totalCents)).toEqual([20_000, 10_000]);

  const before = Date.now();
  await resetWallet(user.id);

  const wallet = await getWallet(user.id);
  expect(wallet.cashCents).toBe(STARTING_CASH_CENTS);
  expect(wallet.positions).toEqual([]);
  expect(wallet.startedAt.getTime()).toBeGreaterThanOrEqual(before);
  expect(await listTrades(user.id)).toEqual([]);
});
