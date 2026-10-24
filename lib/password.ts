import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

import { z } from "zod";

// promisify types scrypt's result as unknown (overloads), so pin the signature
const scryptAsync = promisify(scrypt) as (
  password: string,
  salt: Buffer,
  keylen: number,
) => Promise<Buffer>;
const KEY_LENGTH = 64;
const SALT_BYTES = 16;

// Used when there is no valid stored hash, so a missing account costs the same as a wrong password
const DUMMY_SALT = Buffer.alloc(SALT_BYTES);

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(SALT_BYTES);
  const hash = await scryptAsync(password, salt, KEY_LENGTH);
  return `scrypt$${salt.toString("base64url")}$${hash.toString("base64url")}`;
}

export async function verifyPassword(password: string, stored: string | null): Promise<boolean> {
  const parts = stored?.split("$") ?? [];
  const expected =
    parts.length === 3 && parts[0] === "scrypt" ? Buffer.from(parts[2], "base64url") : null;

  if (!expected || expected.length !== KEY_LENGTH) {
    await scryptAsync(password, DUMMY_SALT, KEY_LENGTH);
    return false;
  }

  const actual = await scryptAsync(password, Buffer.from(parts[1], "base64url"), KEY_LENGTH);
  return timingSafeEqual(actual, expected);
}

export const UsernameSchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z0-9_]{3,20}$/);

export const PasswordSchema = z.string().min(8).max(200);
