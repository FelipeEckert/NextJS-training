import { cacheLife, cacheTag } from "next/cache";
import { fetchAwesomeApi } from "./awesomeapi";
import { FEATURED_PAIRS, PAIRS, findCurrency } from "./currencies";
import { toTradeQuote, type TradeQuote } from "./trade-quote";

export type Quote = {
  pair: string;
  currency: string;
  price: number;
  change: number;
  updatedAt: string;
  bid: string; // raw API strings, so trades keep exact decimals
  ask: string;
};

// Only the response fields we use. Numbers arrive as strings
type ApiResponse = Record<
  string,
  { bid: string; ask: string; pctChange: string; create_date: string }
>;

// One upstream call per minute no matter which pairs callers ask for, so callers can't bypass the cache
async function fetchAllQuotes(): Promise<{ quotes: Quote[]; fetchedAt: number }> {
  // shortcut: default "use cache" lives in each server instance's memory, so on serverless (Vercel) each instance calls the API on its own; switch to "use cache: remote" when traffic grows
  "use cache";
  cacheLife("minutes"); // at most one API call per minute, no matter how many visitors
  cacheTag("quotes"); // a label, so we can throw away this cache on demand

  const fetchPairs = (pairs: string[]) => fetchAwesomeApi(`/json/last/${pairs.join(",")}`);

  // One unknown pair makes AwesomeAPI reject the whole request, so retry with the featured pairs
  let requested = PAIRS;
  let res = await fetchPairs(requested);
  if (!res.ok) {
    requested = FEATURED_PAIRS;
    res = await fetchPairs(requested);
  }

  if (!res.ok) throw new Error(`AwesomeAPI responded ${res.status}`);

  const data: ApiResponse = await res.json();

  const quotes: Quote[] = [];
  for (const pair of requested) {
    const d = data[pair.replace("-", "")]; // the API keys are "USDBRL", without the hyphen
    if (!d) continue; // the API can omit a pair; skip it instead of crashing the page

    quotes.push({
      pair,
      currency: findCurrency(pair)!.label,
      price: Number(d.bid),
      change: Number(d.pctChange),
      updatedAt: d.create_date,
      bid: d.bid,
      ask: d.ask,
    });
  }

  // Saved inside the cache, so it tells us when the API was last called
  return { quotes, fetchedAt: Date.now() };
}

export async function getQuotes(
  pairs: string[] = FEATURED_PAIRS,
): Promise<{ quotes: Quote[]; fetchedAt: number }> {
  // Defense in depth: callers validate too, but we never look up an unknown pair
  if (pairs.some((pair) => !PAIRS.includes(pair))) throw new Error("Unsupported pair");

  const all = await fetchAllQuotes(); // shared cache: reading a subset costs no extra API call
  // Set removes duplicates and keeps first-seen order
  const quotes = [...new Set(pairs)].flatMap((pair) => all.quotes.filter((q) => q.pair === pair));
  return { quotes, fetchedAt: all.fetchedAt };
}

export async function getQuote(pair: string) {
  const upper = pair.toUpperCase();
  if (!PAIRS.includes(upper)) return undefined;

  const { quotes } = await getQuotes([upper]);
  return quotes[0];
}

// Not cached: freshness depends on Date.now(), so the cache stays in fetchAllQuotes
export async function getTradeQuote(pair: string): Promise<TradeQuote | null> {
  try {
    const { quotes, fetchedAt } = await getQuotes([pair]);
    return toTradeQuote(quotes[0], fetchedAt, Date.now());
  } catch {
    return null; // API down or unsupported pair: the caller must not trade
  }
}
