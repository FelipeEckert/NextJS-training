import { cacheLife } from "next/cache";

export type Quote = {
  pair: string;
  currency: string;
  price: number;
  change: number;
  updatedAt: string;
};

// Pairs the dashboard supports. Also an allowlist:
// we never forward a pair to the external API unless it is listed here
export const currencies = [
  { pair: "USD-BRL", currency: "US Dollar (USD)" },
  { pair: "EUR-BRL", currency: "Euro (EUR)" },
  { pair: "BTC-BRL", currency: "Bitcoin (BTC)" },
  { pair: "GBP-BRL", currency: "British Pound (GBP)" },
];

// Only the response fields we use. Numbers arrive as strings
type ApiResponse = Record<string, { bid: string; pctChange: string; create_date: string }>;

export async function getQuotes(): Promise<Quote[]> {
  "use cache";
  cacheLife("minutes"); // at most one API call per minute, no matter how many visitors

  const pairs = currencies.map((c) => c.pair).join(",");
  const res = await fetch(`https://economia.awesomeapi.com.br/json/last/${pairs}`);

  if (!res.ok) throw new Error(`AwesomeAPI responded ${res.status}`);

  const data: ApiResponse = await res.json();

  return currencies.map((c) => {
    const d = data[c.pair.replace("-", "")]; // the API keys are "USDBRL", without the hyphen
    return {
      ...c,
      price: Number(d.bid),
      change: Number(d.pctChange),
      updatedAt: d.create_date,
    };
  });
}

export async function getQuote(pair: string) {
  const quotes = await getQuotes(); // reuses the cache: no extra API call
  return quotes.find((q) => q.pair === pair.toUpperCase());
}
