import { randomUUID } from "node:crypto";

import { eq } from "drizzle-orm";
import { afterAll, expect, it } from "vitest";

import { closeDb, getDb } from "./db";
import { wallets } from "./db/schema";
import { STARTING_CASH_CENTS } from "./money";
import { createUser, ensureDemoUser, verifyLogin } from "./users";

// Unique per test: the dev database is shared, and rows are never deleted
function newUsername() {
  return `t_${randomUUID().replaceAll("-", "").slice(0, 12)}`;
}

const PASSWORD = "correct horse battery";

async function createTestUser(username: string) {
  const created = await createUser(username, PASSWORD);
  if (!created.ok) throw new Error("test setup: username already taken");
  return created.user;
}

afterAll(closeDb);

it("creates a user with a starting wallet", async () => {
  const user = await createTestUser(newUsername());

  const [wallet] = await getDb().select().from(wallets).where(eq(wallets.userId, user.id));
  expect(wallet.cashCents).toBe(STARTING_CASH_CENTS);
});

it("rejects a taken username", async () => {
  const username = newUsername();
  await createTestUser(username);
  expect(await createUser(username, "another password")).toEqual({
    ok: false,
    error: "USERNAME_TAKEN",
  });
});

it("rejects the demo username", async () => {
  expect(await createUser("demo", PASSWORD)).toEqual({ ok: false, error: "USERNAME_TAKEN" });
});

it("logs in with the right password, ignoring username case", async () => {
  const username = newUsername();
  const created = await createTestUser(username);
  expect(await verifyLogin(username.toUpperCase(), PASSWORD)).toEqual(created);
});

it("rejects a wrong password", async () => {
  const username = newUsername();
  await createTestUser(username);
  expect(await verifyLogin(username, "wrong password")).toBeNull();
});

it("locks the account after 5 wrong passwords, even with the right one", async () => {
  const username = newUsername();
  await createTestUser(username);

  for (let i = 0; i < 5; i++) {
    expect(await verifyLogin(username, "wrong password")).toBeNull();
  }
  expect(await verifyLogin(username, PASSWORD)).toBeNull();
});

it("resets the failure counter after a successful login", async () => {
  const username = newUsername();
  await createTestUser(username);

  for (let i = 0; i < 4; i++) await verifyLogin(username, "wrong password");
  expect(await verifyLogin(username, PASSWORD)).not.toBeNull();

  for (let i = 0; i < 4; i++) await verifyLogin(username, "wrong password");
  expect(await verifyLogin(username, PASSWORD)).not.toBeNull();
});

it("creates the demo user once and returns the same id", async () => {
  const first = await ensureDemoUser();
  const second = await ensureDemoUser();
  expect(second).toEqual(first);
  expect(first.username).toBe("demo");
});
