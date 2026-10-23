import { cacheLife, cacheTag } from "next/cache";
import { FEATURED_PAIRS, findCurrency } from "./currencies";

export type Quote = {
  pair: string;
  currency: string;
  price: number;
  change: number;
  updatedAt: string;
};

// Only the response fields we use. Numbers arrive as strings
type ApiResponse = Record<string, { bid: string; pctChange: string; create_date: string }>;

export async function getQuotes(): Promise<{ quotes: Quote[]; fetchedAt: number }> {
  "use cache";
  cacheLife("minutes"); // at most one API call per minute, no matter how many visitors
  cacheTag("quotes"); // a label, so we can throw away this cache on demand

  const pairs = FEATURED_PAIRS.join(",");
  // Fail fast if AwesomeAPI hangs, instead of hanging our page with it
  const res = await fetch(`https://economia.awesomeapi.com.br/json/last/${pairs}`, {
    signal: AbortSignal.timeout(5000),
  });

  if (!res.ok) throw new Error(`AwesomeAPI responded ${res.status}`);

  const data: ApiResponse = await res.json();

  const quotes = FEATURED_PAIRS.map((pair) => {
    const d = data[pair.replace("-", "")]; // the API keys are "USDBRL", without the hyphen
    return {
      pair,
      currency: findCurrency(pair)!.label,
      price: Number(d.bid),
      change: Number(d.pctChange),
      updatedAt: d.create_date,
    };
  });

  // Saved inside the cache, so it tells us when the API was last called
  return { quotes, fetchedAt: Date.now() };
}

export async function getQuote(pair: string) {
  const { quotes } = await getQuotes(); // reuses the cache: no extra API call
  return quotes.find((q) => q.pair === pair.toUpperCase());
}
