import "server-only";

import { sql } from "drizzle-orm";

import { getDb } from "./db";
import { rateLimits } from "./db/schema";

export function windowStart(nowMs: number, windowMs: number): number {
  return Math.floor(nowMs / windowMs) * windowMs;
}

// Rounded up so a client that waits this long never retries into a window that is still full
export function retryAfterSeconds(nowMs: number, windowMs: number): number {
  const endMs = windowStart(nowMs, windowMs) + windowMs;
  return Math.max(1, Math.ceil((endMs - nowMs) / 1000));
}

// shortcut: old windows are never deleted; add a daily cleanup if the table grows
export async function hitRateLimit(
  bucket: string,
  limit: number,
  windowMs: number,
): Promise<{ allowed: boolean; remaining: number; retryAfterSeconds: number }> {
  const now = Date.now();
  const start = windowStart(now, windowMs);
  const [row] = await getDb()
    .insert(rateLimits)
    .values({ bucket, windowStart: new Date(start), count: 1 })
    .onConflictDoUpdate({
      target: [rateLimits.bucket, rateLimits.windowStart],
      set: { count: sql`${rateLimits.count} + 1` },
    })
    .returning({ count: rateLimits.count });
  const count = row.count;
  return {
    allowed: count <= limit,
    remaining: Math.max(0, limit - count),
    retryAfterSeconds: retryAfterSeconds(now, windowMs),
  };
}
