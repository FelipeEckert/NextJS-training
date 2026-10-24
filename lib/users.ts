import "server-only";

import { eq, sql } from "drizzle-orm";

import { getDb } from "./db";
import { users, wallets } from "./db/schema";
import { STARTING_CASH_CENTS } from "./money";
import { hashPassword, verifyPassword } from "./password";
import type { SessionUser } from "./session-token";

export const DEMO_USERNAME = "demo";

const MAX_FAILED_LOGINS = 5;

const UNIQUE_VIOLATION = "23505";

// Drizzle may wrap the driver error, so the Postgres code can sit on err.cause
function isUniqueViolation(err: unknown) {
  const e = err as { code?: string; cause?: { code?: string } } | null;
  return e?.code === UNIQUE_VIOLATION || e?.cause?.code === UNIQUE_VIOLATION;
}

// username must already be validated and lowercase (UsernameSchema)
export async function createUser(
  username: string,
  password: string,
): Promise<{ ok: true; user: SessionUser } | { ok: false; error: "USERNAME_TAKEN" }> {
  // The demo account is created on demand, so its name must be reserved here too
  if (username === DEMO_USERNAME) return { ok: false, error: "USERNAME_TAKEN" };

  const passwordHash = await hashPassword(password);
  try {
    const user = await getDb().transaction(async (tx) => {
      const [row] = await tx
        .insert(users)
        .values({ username, passwordHash })
        .returning({ id: users.id });
      await tx.insert(wallets).values({ userId: row.id, cashCents: STARTING_CASH_CENTS });
      return { id: row.id, username };
    });
    return { ok: true, user };
  } catch (err) {
    if (isUniqueViolation(err)) return { ok: false, error: "USERNAME_TAKEN" };
    throw err;
  }
}

// Returns the user for a correct password, otherwise null. Lockout: 5 wrong passwords lock the
// account for 15 minutes, and a locked account rejects even the right password.
export async function verifyLogin(username: string, password: string): Promise<SessionUser | null> {
  const db = getDb();
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.username, username.trim().toLowerCase()));

  // Same scrypt cost for a missing account as for a wrong password, so timing doesn't reveal the username
  if (!user) {
    await verifyPassword(password, null);
    return null;
  }

  // The demo account has no password, so it can only be entered with the "Try the demo" button
  if (user.passwordHash === null) return null;

  const locked = user.lockedUntil !== null && user.lockedUntil > new Date();
  // Run even when locked, so a locked account costs the same as a wrong password
  const ok = await verifyPassword(password, user.passwordHash);
  if (locked) return null;

  if (!ok) {
    // Count in SQL so parallel wrong guesses can't lose an increment
    const [row] = await db
      .update(users)
      .set({ failedLogins: sql`${users.failedLogins} + 1` })
      .where(eq(users.id, user.id))
      .returning({ failedLogins: users.failedLogins });
    if (row.failedLogins >= MAX_FAILED_LOGINS) {
      await db
        .update(users)
        .set({ lockedUntil: sql`now() + interval '15 minutes'`, failedLogins: 0 })
        .where(eq(users.id, user.id));
    }
    return null;
  }

  await db.update(users).set({ failedLogins: 0 }).where(eq(users.id, user.id));
  return { id: user.id, username: user.username };
}

// Idempotent: creates the demo account and its wallet on first use, then returns it
export async function ensureDemoUser(): Promise<SessionUser> {
  const db = getDb();
  await db
    .insert(users)
    .values({ username: DEMO_USERNAME, passwordHash: null })
    .onConflictDoNothing();
  const [user] = await db
    .select({ id: users.id, username: users.username })
    .from(users)
    .where(eq(users.username, DEMO_USERNAME));
  await db
    .insert(wallets)
    .values({ userId: user.id, cashCents: STARTING_CASH_CENTS })
    .onConflictDoNothing();
  return user;
}
