import { randomUUID } from "node:crypto";

import { afterAll, expect, it } from "vitest";

import { authenticateApiKey, createApiKey, listApiKeys, revokeApiKey } from "./api-keys";
import { closeDb } from "./db";
import { createUser, ensureDemoUser } from "./users";

// Unique per test: the dev database is shared, and rows are never deleted
function newUsername() {
  return `t_${randomUUID().replaceAll("-", "").slice(0, 12)}`;
}

async function createTestUser() {
  const created = await createUser(newUsername(), "correct horse battery");
  if (!created.ok) throw new Error("test setup: username already taken");
  return created.user;
}

afterAll(closeDb);

it("allows 3 active keys, rejects a 4th, and allows a new one after a revoke", async () => {
  const user = await createTestUser();

  const keys = [];
  for (const name of ["a", "b", "c"]) {
    const created = await createApiKey(user, name);
    if (!created.ok) throw new Error("expected a key");
    keys.push(created.key);
  }
  expect(await createApiKey(user, "d")).toEqual({ ok: false, code: "LIMIT_REACHED" });

  const [first] = await listApiKeys(user.id);
  await revokeApiKey(user.id, first.id);
  expect(await listApiKeys(user.id)).toHaveLength(2);
  expect(await createApiKey(user, "d")).toMatchObject({ ok: true });
});

it("refuses the demo user", async () => {
  const demo = await ensureDemoUser();
  expect(await createApiKey(demo, "bot")).toEqual({ ok: false, code: "DEMO_NOT_ALLOWED" });
});

it("authenticates a bearer key to its user and key id", async () => {
  const user = await createTestUser();
  const created = await createApiKey(user, "bot");
  if (!created.ok) throw new Error("expected a key");

  const [listed] = await listApiKeys(user.id);
  expect(await authenticateApiKey(`Bearer ${created.key}`)).toEqual({
    userId: user.id,
    keyId: listed.id,
  });
  expect((await listApiKeys(user.id))[0].lastUsedAt).not.toBeNull();
});

it("rejects a revoked key", async () => {
  const user = await createTestUser();
  const created = await createApiKey(user, "bot");
  if (!created.ok) throw new Error("expected a key");

  const [listed] = await listApiKeys(user.id);
  await revokeApiKey(user.id, listed.id);
  expect(await authenticateApiKey(`Bearer ${created.key}`)).toBeNull();
});

it("rejects garbage and missing headers", async () => {
  expect(await authenticateApiKey(null)).toBeNull();
  expect(await authenticateApiKey("Basic abc")).toBeNull();
  expect(await authenticateApiKey("Bearer ptk_not_a_real_key")).toBeNull();
});

it("ignores revoke calls for another user's key", async () => {
  const owner = await createTestUser();
  const other = await createTestUser();
  const created = await createApiKey(owner, "bot");
  if (!created.ok) throw new Error("expected a key");

  const [listed] = await listApiKeys(owner.id);
  await revokeApiKey(other.id, listed.id);
  expect(await authenticateApiKey(`Bearer ${created.key}`)).not.toBeNull();
});
