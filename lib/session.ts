import "server-only"; // build error if a Client Component ever imports this file (it holds the secret)

import { cacheLife } from "next/cache";
import { cookies } from "next/headers";
import { signToken, verifyToken, type SessionUser } from "./session-token";

// Must match the name proxy.ts checks for
const SESSION_COOKIE = "session";
const SESSION_DAYS = 7;

function getSecret() {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("SESSION_SECRET must be set in .env.local (at least 32 characters)");
  }
  return secret;
}

// Only works in a Server Action or Route Handler (they can send Set-Cookie headers)
export async function createSession(user: SessionUser) {
  const expiresAt = Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000;

  (await cookies()).set(SESSION_COOKIE, signToken(user, expiresAt, getSecret()), {
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
export async function getCurrentUser(): Promise<SessionUser | null> {
  // The docs' pattern for auth helpers: the expiry check uses Date.now(), which Cache Components
  // won't run while prerendering. "use cache: private" allows it, and caches the result only in
  // this visitor's browser (never on the server), so the header can be prefetched per session.
  "use cache: private";
  cacheLife("minutes");

  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null; // no secret needed without a cookie
  return verifyToken(token, getSecret(), Date.now());
}
