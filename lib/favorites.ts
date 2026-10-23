import { cookies } from "next/headers";
import { z } from "zod";
import { currencies } from "./quotes";

const COOKIE_NAME = "favorites";
const ONE_YEAR_IN_SECONDS = 60 * 60 * 24 * 365;

// A valid favorite is any pair from the allowlist, and nothing else
export const PairSchema = z.enum(currencies.map((c) => c.pair) as [string, ...string[]]);

export async function getFavorites(): Promise<string[]> {
  const raw = (await cookies()).get(COOKIE_NAME)?.value ?? "";

  // The cookie is user input: anyone can edit it in DevTools.
  // So we drop unknown values and duplicates instead of trusting it
  const valid = raw.split(",").filter((p) => PairSchema.safeParse(p).success);
  return [...new Set(valid)];
}

// Idempotent: it receives the desired state, not "flip it".
// Running it once or ten times (e.g. a retry on a bad network) gives the same result
// Only works inside a Server Action or Route Handler (they can send Set-Cookie headers)
export async function setFavorite(pair: string, favorite: boolean) {
  const others = (await getFavorites()).filter((p) => p !== pair);
  await saveFavorites(favorite ? [...others, pair] : others);
}

async function saveFavorites(pairs: string[]) {
  (await cookies()).set(COOKIE_NAME, pairs.join(","), {
    httpOnly: true, // browser JavaScript can't read it, so an XSS attack can't steal it
    secure: process.env.NODE_ENV === "production", // HTTPS only in production (localhost is HTTP)
    sameSite: "lax", // not sent on POSTs from other sites, which helps against CSRF
    path: "/", // valid on every page
    maxAge: ONE_YEAR_IN_SECONDS, // without it, the cookie dies when the browser closes
  });
}
