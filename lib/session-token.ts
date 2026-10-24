// Pure on purpose: no Next.js or database imports, so the token rules can be unit tested.

import { createHash, createHmac, timingSafeEqual } from "node:crypto";

export type SessionUser = { id: number; username: string };

// The session is a *signed* token: "<id>.<username>.<expiresAt>.<signature>".
// Anyone can read it, but nobody can change it without the secret,
// because any change breaks the signature.
// shortcut: hand-rolled HMAC to show how signing works; in production use a library like iron-session or Auth.js

const ID_PATTERN = /^[1-9]\d*$/;
const USERNAME_PATTERN = /^[a-z0-9_]{3,20}$/;
const EXPIRES_PATTERN = /^\d+$/;

function sign(payload: string, secret: string) {
  return createHmac("sha256", secret).update(payload).digest("base64url");
}

// Compares in constant time, so an attacker can't guess a value byte by byte
// by measuring how long each wrong guess takes (a "timing attack")
function safeEqual(a: string, b: string) {
  const hashA = createHash("sha256").update(a).digest();
  const hashB = createHash("sha256").update(b).digest();
  return timingSafeEqual(hashA, hashB);
}

export function signToken(user: SessionUser, expiresAt: number, secret: string): string {
  const payload = `${user.id}.${user.username}.${expiresAt}`;
  return `${payload}.${sign(payload, secret)}`;
}

// Returns the user if the token is well formed, authentic and not expired, otherwise null
export function verifyToken(
  token: string | undefined,
  secret: string,
  nowMs: number,
): SessionUser | null {
  const parts = token?.split(".") ?? [];
  if (parts.length !== 4) return null;
  const [id, username, expiresAt, signature] = parts;
  if (!ID_PATTERN.test(id) || !USERNAME_PATTERN.test(username) || !EXPIRES_PATTERN.test(expiresAt)) {
    return null;
  }
  if (!safeEqual(signature, sign(`${id}.${username}.${expiresAt}`, secret))) return null; // tampered
  if (Number(expiresAt) < nowMs) return null; // expired
  return { id: Number(id), username };
}
