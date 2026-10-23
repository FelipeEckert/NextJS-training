// Plain data with no server APIs, so it's safe to import anywhere (including proxy.ts).
// The allowlist of pairs we support: we never forward a pair to the external API unless it is here.

export type Currency = { code: string; pair: string; name: string; label: string };

// Names are hand-written, because crypto codes are missing from Intl.DisplayNames
const NAMES: [string, string][] = [
  ["USD", "US Dollar"],
  ["CAD", "Canadian Dollar"],
  ["EUR", "Euro"],
  ["GBP", "British Pound"],
  ["ARS", "Argentine Peso"],
  ["BTC", "Bitcoin"],
  ["LTC", "Litecoin"],
  ["JPY", "Japanese Yen"],
  ["CHF", "Swiss Franc"],
  ["AUD", "Australian Dollar"],
  ["CNY", "Chinese Yuan"],
  ["ILS", "Israeli New Shekel"],
  ["ETH", "Ethereum"],
  ["XRP", "XRP"],
  ["DOGE", "Dogecoin"],
  ["SGD", "Singapore Dollar"],
  ["AED", "United Arab Emirates Dirham"],
  ["DKK", "Danish Krone"],
  ["HKD", "Hong Kong Dollar"],
  ["MXN", "Mexican Peso"],
  ["NOK", "Norwegian Krone"],
  ["NZD", "New Zealand Dollar"],
  ["PLN", "Polish Zloty"],
  ["SAR", "Saudi Riyal"],
  ["SEK", "Swedish Krona"],
  ["THB", "Thai Baht"],
  ["TRY", "Turkish Lira"],
  ["TWD", "New Taiwan Dollar"],
  ["VEF", "Venezuelan Bolívar"],
  ["ZAR", "South African Rand"],
  ["CLP", "Chilean Peso"],
  ["PYG", "Paraguayan Guarani"],
  ["UYU", "Uruguayan Peso"],
  ["COP", "Colombian Peso"],
  ["PEN", "Peruvian Sol"],
  ["BOB", "Bolivian Boliviano"],
  ["RUB", "Russian Ruble"],
  ["INR", "Indian Rupee"],
  ["XAU", "Gold"],
  ["XAG", "Silver"],
  ["RSD", "Serbian Dinar"],
  ["KRW", "South Korean Won"],
  ["BRETT", "Brett"],
  ["SOL", "Solana"],
  ["BNB", "BNB"],
  ["CRC", "Costa Rican Colón"],
  ["RON", "Romanian Leu"],
  ["EGP", "Egyptian Pound"],
  ["KES", "Kenyan Shilling"],
  ["PHP", "Philippine Peso"],
  ["HUF", "Hungarian Forint"],
  ["CZK", "Czech Koruna"],
];

export const CATALOG: Currency[] = NAMES.map(([code, name]) => ({
  code,
  pair: `${code}-BRL`,
  name,
  label: `${name} (${code})`,
}));

export const PAIRS: string[] = CATALOG.map((c) => c.pair);

// The pairs shown on the home page and prerendered at build time
export const FEATURED_PAIRS = ["USD-BRL", "EUR-BRL", "BTC-BRL", "GBP-BRL"];

// Case-insensitive, so "usd-brl" from a URL still finds USD-BRL
export function findCurrency(pair: string): Currency | undefined {
  return CATALOG.find((c) => c.pair === pair.toUpperCase());
}

// Matches the code or the name. Ignores case and surrounding spaces; an empty query keeps everything
export function filterCurrencies(list: Currency[], query: string): Currency[] {
  const q = query.trim().toLowerCase();
  if (!q) return list;
  return list.filter(
    (c) => c.code.toLowerCase().includes(q) || c.name.toLowerCase().includes(q),
  );
}
