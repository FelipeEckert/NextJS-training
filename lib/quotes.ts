import { cacheLife, cacheTag } from "next/cache";
import { FEATURED_PAIRS, PAIRS, findCurrency } from "./currencies";

export type Quote = {
  pair: string;
  currency: string;
  price: number;
  change: number;
  updatedAt: string;
};

// Only the response fields we use. Numbers arrive as strings
type ApiResponse = Record<string, { bid: string; pctChange: string; create_date: string }>;

export async function getQuotes(
  pairs: string[] = FEATURED_PAIRS,
): Promise<{ quotes: Quote[]; fetchedAt: number }> {
  "use cache";
  cacheLife("minutes"); // at most one API call per minute, no matter how many visitors
  cacheTag("quotes"); // a label, so we can throw away this cache on demand

  // Defense in depth: callers validate too, but we never forward an unknown pair to the API
  if (pairs.some((pair) => !PAIRS.includes(pair))) throw new Error("Unsupported pair");

  // Fail fast if AwesomeAPI hangs, instead of hanging our page with it
  const res = await fetch(`https://economia.awesomeapi.com.br/json/last/${pairs.join(",")}`, {
    signal: AbortSignal.timeout(5000),
  });

  if (!res.ok) throw new Error(`AwesomeAPI responded ${res.status}`);

  const data: ApiResponse = await res.json();

  const quotes: Quote[] = [];
  for (const pair of pairs) {
    const d = data[pair.replace("-", "")]; // the API keys are "USDBRL", without the hyphen
    if (!d) continue; // the API can omit a pair; skip it instead of crashing the page

    quotes.push({
      pair,
      currency: findCurrency(pair)!.label,
      price: Number(d.bid),
      change: Number(d.pctChange),
      updatedAt: d.create_date,
    });
  }

  // Saved inside the cache, so it tells us when the API was last called
  return { quotes, fetchedAt: Date.now() };
}

export async function getQuote(pair: string) {
  const upper = pair.toUpperCase();
  if (!PAIRS.includes(upper)) return undefined;

  const { quotes } = await getQuotes([upper]); // its own cache entry, one API call per pair
  return quotes[0];
}
