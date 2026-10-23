// Plain data with no server APIs, so it's safe to import anywhere (including proxy.ts).
// Pairs the dashboard supports. Also an allowlist:
// we never forward a pair to the external API unless it is listed here
export const currencies = [
  { pair: "USD-BRL", currency: "US Dollar (USD)" },
  { pair: "EUR-BRL", currency: "Euro (EUR)" },
  { pair: "BTC-BRL", currency: "Bitcoin (BTC)" },
  { pair: "GBP-BRL", currency: "British Pound (GBP)" },
];

export const PAIRS = currencies.map((c) => c.pair);
