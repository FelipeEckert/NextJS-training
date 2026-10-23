import "server-only"; // build error if a Client Component ever imports this file (it holds the secret)

import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { cacheLife } from "next/cache";
import { cookies } from "next/headers";

// Must match the name proxy.ts checks for
const SESSION_COOKIE = "session";
const SESSION_DAYS = 7;

// The session is a *signed* cookie: "<username>.<expiresAt>.<signature>".
// Anyone can read it, but nobody can change it without SESSION_SECRET,
// because any change breaks the signature.
// shortcut: hand-rolled HMAC to show how signing works; in production use a library like iron-session or Auth.js

function getSecret() {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("SESSION_SECRET must be set in .env.local (at least 32 characters)");
  }
  return secret;
}

function sign(payload: string) {
  return createHmac("sha256", getSecret()).update(payload).digest("base64url");
}

// Compares in constant time, so an attacker can't guess a value byte by byte
// by measuring how long each wrong guess takes (a "timing attack")
function safeEqual(a: string, b: string) {
  const hashA = createHash("sha256").update(a).digest();
  const hashB = createHash("sha256").update(b).digest();
  return timingSafeEqual(hashA, hashB);
}

// Returns the username if the token is authentic and not expired, otherwise null
function verifyToken(token: string | undefined): string | null {
  const [username, expiresAt, signature] = token?.split(".") ?? [];
  if (!username || !expiresAt || !signature) return null;
  if (!safeEqual(signature, sign(`${username}.${expiresAt}`))) return null; // tampered
  if (Number(expiresAt) < Date.now()) return null; // expired
  return username;
}

export function checkCredentials(username: string, password: string) {
  const expectedPassword = process.env.DEMO_PASSWORD;
  if (!expectedPassword) throw new Error("DEMO_PASSWORD must be set in .env.local");

  // Check both, always, so the response time doesn't reveal which one was wrong
  const userOk = safeEqual(username, "demo");
  const passwordOk = safeEqual(password, expectedPassword);
  return userOk && passwordOk;
}

// Only works in a Server Action or Route Handler (they can send Set-Cookie headers)
export async function createSession(username: string) {
  const expiresAt = Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000;
  const payload = `${username}.${expiresAt}`;

  (await cookies()).set(SESSION_COOKIE, `${payload}.${sign(payload)}`, {
    httpOnly: true, // browser JavaScript can't read it, so XSS can't steal the session
    secure: process.env.NODE_ENV === "production", // HTTPS only in production
    sameSite: "lax", // not sent on cross-site POSTs (CSRF)
    path: "/",
    maxAge: SESSION_DAYS * 24 * 60 * 60,
  });
}

export async function deleteSession() {
  (await cookies()).delete(SESSION_COOKIE);
}

// The real check. Call it in every page AND every Server Action that needs a user.
export async function getCurrentUser(): Promise<string | null> {
  // The docs' pattern for auth helpers: the expiry check uses Date.now(), which Cache Components
  // won't run while prerendering. "use cache: private" allows it, and caches the result only in
  // this visitor's browser (never on the server), so the header can be prefetched per session.
  "use cache: private";
  cacheLife("minutes");

  return verifyToken((await cookies()).get(SESSION_COOKIE)?.value);
}
