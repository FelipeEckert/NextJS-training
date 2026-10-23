"use server"; // runs only on the server, but the browser can call it like an API endpoint

import { updateTag } from "next/cache";
import { getQuotes } from "@/lib/quotes";

const COOLDOWN_MS = 30_000; // AwesomeAPI updates about every 30s, so refreshing faster gains nothing

export type RefreshState = { message: string } | null;

export async function refreshQuotes(): Promise<RefreshState> {
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
