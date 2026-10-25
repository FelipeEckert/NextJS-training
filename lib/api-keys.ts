import "server-only";

import { createHash, randomBytes } from "node:crypto";

import { and, count, desc, eq, isNull, sql } from "drizzle-orm";

import { getDb } from "./db";
import { apiKeys } from "./db/schema";
import { DEMO_USERNAME } from "./users";

const MAX_ACTIVE_KEYS = 3;

export function hashApiKey(key: string): string {
  return createHash("sha256").update(key).digest("hex");
}

export function generateApiKey(): { key: string; prefix: string; hash: string } {
  const key = `ptk_${randomBytes(32).toString("base64url")}`;
  return { key, prefix: key.slice(0, 12), hash: hashApiKey(key) };
}

export function parseBearer(header: string | null): string | null {
  const match = /^bearer\s+(\S+)$/i.exec(header?.trim() ?? "");
  return match ? match[1] : null;
}

// The plain key is returned here only; the database keeps just its hash
export async function createApiKey(
  user: { id: number; username: string },
  name: string,
): Promise<{ ok: true; key: string } | { ok: false; code: "LIMIT_REACHED" | "DEMO_NOT_ALLOWED" }> {
  if (user.username === DEMO_USERNAME) return { ok: false, code: "DEMO_NOT_ALLOWED" };

  const db = getDb();
  // shortcut: two simultaneous creates can exceed 3 keys; lock the user row if it matters
  const [row] = await db
    .select({ count: count() })
    .from(apiKeys)
    .where(and(eq(apiKeys.userId, user.id), isNull(apiKeys.revokedAt)));
  if (row.count >= MAX_ACTIVE_KEYS) return { ok: false, code: "LIMIT_REACHED" };

  const { key, prefix, hash } = generateApiKey();
  await db.insert(apiKeys).values({ userId: user.id, name, prefix, keyHash: hash });
  return { ok: true, key };
}

export async function listApiKeys(userId: number) {
  return getDb()
    .select({
      id: apiKeys.id,
      name: apiKeys.name,
      prefix: apiKeys.prefix,
      createdAt: apiKeys.createdAt,
      lastUsedAt: apiKeys.lastUsedAt,
    })
    .from(apiKeys)
    .where(and(eq(apiKeys.userId, userId), isNull(apiKeys.revokedAt)))
    .orderBy(desc(apiKeys.createdAt), desc(apiKeys.id));
}

// Scoped to the owner: another user's id matches no rows and changes nothing
export async function revokeApiKey(userId: number, id: number): Promise<void> {
  await getDb()
    .update(apiKeys)
    .set({ revokedAt: sql`now()` })
    .where(and(eq(apiKeys.id, id), eq(apiKeys.userId, userId), isNull(apiKeys.revokedAt)));
}

// One UPDATE both finds the active key and stamps lastUsedAt
export async function authenticateApiKey(
  authorization: string | null,
): Promise<{ userId: number; keyId: number } | null> {
  const key = parseBearer(authorization);
  if (!key) return null;

  const [row] = await getDb()
    .update(apiKeys)
    .set({ lastUsedAt: sql`now()` })
    .where(and(eq(apiKeys.keyHash, hashApiKey(key)), isNull(apiKeys.revokedAt)))
    .returning({ userId: apiKeys.userId, keyId: apiKeys.id });
  return row ?? null;
}
