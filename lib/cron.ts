import { timingSafeEqual } from "node:crypto";

// Vercel Cron calls the cron routes with Authorization: Bearer <CRON_SECRET>
export function isCronRequest(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const given = Buffer.from(request.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${secret}`);
  // timingSafeEqual throws on different lengths, so the length check comes first
  return given.length === expected.length && timingSafeEqual(given, expected);
}
