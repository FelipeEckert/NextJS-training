"use server"; // runs only on the server, but the browser can call it like an API endpoint

import { updateTag } from "next/cache";
import { z } from "zod";
import { PairSchema, setFavorite } from "@/lib/favorites";
import { getQuotes } from "@/lib/quotes";
import { getCurrentUser } from "@/lib/session";

const COOLDOWN_MS = 30_000; // AwesomeAPI updates about every 30s, so refreshing faster gains nothing

export type RefreshState = { message: string } | null;

export async function refreshQuotes(): Promise<RefreshState> {
  // Only signed-in users can force a refresh. Checked HERE, inside the action,
  // because hiding the button wouldn't stop anyone from calling the endpoint directly
  if (!(await getCurrentUser())) return { message: "Sign in to refresh the rates." };

  // Server Actions are public endpoints: anyone can call this in a loop.
  // The cooldown is global, so no caller can bust the cache more than once per 30s.
  // shortcut: the cache lives in this server's memory, so with many server instances each has its own cooldown; use a shared store (e.g. Redis) when scaling out
  const { fetchedAt } = await getQuotes();
  const waitMs = COOLDOWN_MS - (Date.now() - fetchedAt);

  if (waitMs > 0) {
    return { message: `Rates are already fresh. Try again in ${Math.ceil(waitMs / 1000)}s.` };
  }

  updateTag("quotes"); // expire the cache now; the page re-renders with fresh data
  return { message: "Rates updated." };
}

const FavoriteInput = z.object({ pair: PairSchema, favorite: z.boolean() });

// Typed as unknown on purpose: anyone can call this endpoint with any value.
// It takes the desired state (not a toggle), so retrying it is safe
export async function setFavoriteAction(pair: unknown, favorite: unknown) {
  const parsed = FavoriteInput.safeParse({ pair, favorite });
  if (!parsed.success) return; // invalid input: ignore it

  // Changing a cookie in a Server Action makes Next.js re-render the page with the new value
  await setFavorite(parsed.data.pair, parsed.data.favorite);
}
