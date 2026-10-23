# Wallet History, Search and Charts Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let users search all 52 BRL currencies and see a daily price chart plus 7D/1M/3M/1Y analysis for each one.

**Architecture:** A static English catalog (`lib/currencies.ts`) becomes the single allowlist. Pure, unit-tested functions parse AwesomeAPI history, slice ranges, compute stats and build the SVG path (`lib/analysis.ts`, `lib/chart.ts`). A cached `getHistory()` fetches 360 daily points once per pair per hour; the detail page renders a server-side SVG chart and stats behind `<Suspense>`.

**Tech Stack:** Next.js 16.4 (App Router, Cache Components), React 19.3, TypeScript, Tailwind 4, zod 4, Vitest (new dev dependency).

**Spec:** `docs/superpowers/specs/2026-10-23-wallet-history-design.md`

## Global Constraints

- Read the relevant guide in `node_modules/next/dist/docs/` before writing Next.js code (AGENTS.md). This Next version differs from older tutorials.
- All UI copy in English. Format money with the existing `formatBRL()` from `lib/format.ts`.
- Charts are server-rendered SVG. No chart library, and no `"use client"` in chart code.
- Validate every user-supplied pair against `PAIRS` from `lib/currencies.ts`.
- Code comments explain *why*, in one line, in simple English (the project owner is learning).
- Bash on this machine needs Node on PATH: run `export PATH="$PATH:/c/Program Files/nodejs"` first.
- Done means: `npx vitest run`, `npx eslint .` and `npx tsc --noEmit` all exit 0.
- End every commit message with: `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`
- The dev server is already running on http://localhost:3000. Don't start another one.

## Review Focus

1. **Empty or failed history** (an exotic pair returns `[]` or errors): the page shows "No price history available" instead of crashing. Pinned by `summarize([]) === null`, `parseHistory([])` tests (Task 2) and the empty branch in Task 4.
2. **Flat prices** (min equals max): the chart draws a flat middle line, with no `NaN` in the path. Pinned in Task 2's `buildLinePath` tests.
3. **A single data point:** change 0, volatility 0, chart path is one `M` point. Pinned in Task 2.
4. **A bad `?range=` value** (`abc`, missing, repeated): falls back to `1M`. Pinned by `parseRange` tests (Task 2).
5. **A bad upstream item** (`bid: "abc"`, missing `timestamp`): dropped, never `NaN` in stats or chart. Pinned by `parseHistory` tests (Task 2).

---

### Task 1: Test runner and the 52-currency catalog

**Files:**
- Modify: `package.json` (add `vitest` dev dependency and `"test": "vitest run"` script)
- Rewrite: `lib/currencies.ts`
- Create: `lib/currencies.test.ts`
- Modify consumers of the old `currencies` export: `lib/quotes.ts`, `app/api/quotes/route.ts`, `app/currency/[pair]/page.tsx`

**Interfaces:**
- Produces:
  - `type Currency = { code: string; pair: string; name: string; label: string }` where `pair = \`${code}-BRL\`` and `label = \`${name} (${code})\``
  - `CATALOG: Currency[]` (52 entries, order below)
  - `PAIRS: string[]` (all catalog pairs)
  - `FEATURED_PAIRS: string[]` = `["USD-BRL", "EUR-BRL", "BTC-BRL", "GBP-BRL"]`
  - `findCurrency(pair: string): Currency | undefined` (case-insensitive)
  - `filterCurrencies(list: Currency[], query: string): Currency[]` (case-insensitive substring match on `code` or `name`; trims the query; empty query returns `list`; keeps order)
- The old `currencies` export is removed.

Catalog data, `[code, name]` in this order (built from `/json/available` + `Intl.DisplayNames`, with crypto names added by hand):

```
USD US Dollar | CAD Canadian Dollar | EUR Euro | GBP British Pound | ARS Argentine Peso |
BTC Bitcoin | LTC Litecoin | JPY Japanese Yen | CHF Swiss Franc | AUD Australian Dollar |
CNY Chinese Yuan | ILS Israeli New Shekel | ETH Ethereum | XRP XRP | DOGE Dogecoin |
SGD Singapore Dollar | AED United Arab Emirates Dirham | DKK Danish Krone | HKD Hong Kong Dollar |
MXN Mexican Peso | NOK Norwegian Krone | NZD New Zealand Dollar | PLN Polish Zloty |
SAR Saudi Riyal | SEK Swedish Krona | THB Thai Baht | TRY Turkish Lira | TWD New Taiwan Dollar |
VEF Venezuelan Bolívar | ZAR South African Rand | CLP Chilean Peso | PYG Paraguayan Guarani |
UYU Uruguayan Peso | COP Colombian Peso | PEN Peruvian Sol | BOB Bolivian Boliviano |
RUB Russian Ruble | INR Indian Rupee | XAU Gold | XAG Silver | RSD Serbian Dinar |
KRW South Korean Won | BRETT Brett | SOL Solana | BNB BNB | CRC Costa Rican Colón |
RON Romanian Leu | EGP Egyptian Pound | KES Kenyan Shilling | PHP Philippine Peso |
HUF Hungarian Forint | CZK Czech Koruna
```

- [ ] **Step 1: Install Vitest and add the script**

Run: `npm install -D vitest`, then add `"test": "vitest run"` to `scripts` in `package.json`.

- [ ] **Step 2: Write the failing tests in `lib/currencies.test.ts`** (import from `./currencies`, relative path)

```ts
import { describe, expect, it } from "vitest";
import { CATALOG, FEATURED_PAIRS, PAIRS, filterCurrencies, findCurrency } from "./currencies";

describe("catalog", () => {
  it("has 52 unique currencies quoted in BRL", () => {
    expect(CATALOG).toHaveLength(52);
    expect(new Set(CATALOG.map((c) => c.code)).size).toBe(52);
    for (const c of CATALOG) {
      expect(c.pair).toBe(`${c.code}-BRL`);
      expect(c.label).toBe(`${c.name} (${c.code})`);
    }
    expect(PAIRS).toEqual(CATALOG.map((c) => c.pair));
  });

  it("features four pairs that are all in the catalog", () => {
    expect(FEATURED_PAIRS).toEqual(["USD-BRL", "EUR-BRL", "BTC-BRL", "GBP-BRL"]);
    for (const p of FEATURED_PAIRS) expect(PAIRS).toContain(p);
  });
});

describe("findCurrency", () => {
  it("finds a pair in any letter case", () => {
    expect(findCurrency("usd-brl")?.label).toBe("US Dollar (USD)");
  });
  it("returns undefined for unknown pairs", () => {
    expect(findCurrency("XYZ-BRL")).toBeUndefined();
  });
});

describe("filterCurrencies", () => {
  it("matches the name, case-insensitively", () => {
    expect(filterCurrencies(CATALOG, "yen").map((c) => c.code)).toEqual(["JPY"]);
  });
  it("matches the code and trims the query", () => {
    expect(filterCurrencies(CATALOG, "  jpy ").map((c) => c.code)).toEqual(["JPY"]);
  });
  it("returns every currency for an empty query", () => {
    expect(filterCurrencies(CATALOG, "   ")).toEqual(CATALOG);
  });
  it("keeps catalog order", () => {
    expect(filterCurrencies(CATALOG, "dollar").map((c) => c.code).slice(0, 3)).toEqual(["USD", "CAD", "AUD"]);
  });
});
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `npx vitest run lib/currencies.test.ts`
Expected: FAIL (`CATALOG` is not exported).

- [ ] **Step 4: Rewrite `lib/currencies.ts`** with the interfaces above. Keep the header comment that it's plain data, safe to import anywhere (including `proxy.ts`). Build `CATALOG` from a `[code, name][]` array with the data above.

- [ ] **Step 5: Update the three consumers of the removed `currencies` export**

- `lib/quotes.ts`: build its list from `FEATURED_PAIRS` and use `findCurrency(pair)!.label` as each quote's `currency` field (Task 3 generalizes this further).
- `app/api/quotes/route.ts`: `const allowed = PAIRS;`
- `app/currency/[pair]/page.tsx`: `generateStaticParams` returns `FEATURED_PAIRS.map((pair) => ({ pair }))`.

- [ ] **Step 6: Verify**

Run: `npx vitest run && npx eslint . && npx tsc --noEmit`
Expected: all tests pass, both commands exit 0. Then `curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/currency/JPY-BRL` returns `200` (the proxy now accepts all 52 pairs).

- [ ] **Step 7: Commit**

```bash
git add package.json package-lock.json lib/currencies.ts lib/currencies.test.ts lib/quotes.ts app/api/quotes/route.ts "app/currency/[pair]/page.tsx"
git commit -m "Add 52-currency catalog with search filter and Vitest"
```

---

### Task 2: Pure history math (parsing, ranges, stats, chart path)

**Files:**
- Create: `lib/analysis.ts`, `lib/analysis.test.ts`
- Create: `lib/chart.ts`, `lib/chart.test.ts`

**Interfaces:**
- Produces (in `lib/analysis.ts`):
  - `type PricePoint = { date: string; close: number }` (`date` = UTC `YYYY-MM-DD`)
  - `type Range = "7D" | "1M" | "3M" | "1Y"`, `RANGES: Range[]` in that order, `RANGE_DAYS: Record<Range, number>` = `{ "7D": 7, "1M": 30, "3M": 90, "1Y": 360 }`
  - `parseRange(value: string | undefined): Range` (unknown or missing → `"1M"`)
  - `parseHistory(json: unknown): PricePoint[]`: validates each item with zod (`bid` and `timestamp` strings), converts `bid` to `close` and `timestamp` (Unix seconds) to `date`, drops items that fail validation or have a non-finite number, returns **oldest first**. Not an array → `[]`.
  - `sliceRange(points: PricePoint[], range: Range): PricePoint[]`: the last `RANGE_DAYS[range]` points
  - `type Summary = { first: number; last: number; change: number; changePct: number; min: number; max: number; average: number; volatility: number }`
  - `summarize(points: PricePoint[]): Summary | null`: `null` for `[]`. `volatility` = population standard deviation of day-to-day % changes (`0` with fewer than 2 points).
- Produces (in `lib/chart.ts`):
  - `buildLinePath(values: number[], width: number, height: number): string`: SVG path `"M x,y L x,y …"`. `x = i / (n - 1) * width` (single value → `x = 0`), `y = height - (v - min) / (max - min) * height`, and when `max === min` every `y = height / 2`. Each coordinate goes through `Number(n.toFixed(1))`. Empty input → `""`.

- [ ] **Step 1: Write the failing tests**

`lib/analysis.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { parseHistory, parseRange, sliceRange, summarize, type PricePoint } from "./analysis";

const pts = (closes: number[]): PricePoint[] =>
  closes.map((close, i) => ({ date: `2026-01-${String(i + 1).padStart(2, "0")}`, close }));

describe("parseHistory", () => {
  it("converts newest-first API items into oldest-first points", () => {
    const json = [
      { bid: "4.994", timestamp: "1792784356", code: "USD" },
      { bid: "5.0523", timestamp: "1792708204" },
      { bid: "5.0236", timestamp: "1792621806" },
    ];
    expect(parseHistory(json)).toEqual([
      { date: "2026-10-21", close: 5.0236 },
      { date: "2026-10-22", close: 5.0523 },
      { date: "2026-10-23", close: 4.994 },
    ]);
  });
  it("drops invalid items", () => {
    const json = [{ bid: "abc", timestamp: "1792784356" }, { timestamp: "1792708204" }, { bid: "5.1", timestamp: "1792621806" }];
    expect(parseHistory(json)).toEqual([{ date: "2026-10-21", close: 5.1 }]);
  });
  it("returns [] for anything that isn't an array", () => {
    expect(parseHistory({ status: 404 })).toEqual([]);
    expect(parseHistory([])).toEqual([]);
  });
});

describe("parseRange", () => {
  it("accepts known ranges and defaults everything else to 1M", () => {
    expect(parseRange("1Y")).toBe("1Y");
    expect(parseRange("abc")).toBe("1M");
    expect(parseRange(undefined)).toBe("1M");
  });
});

describe("sliceRange", () => {
  it("keeps the most recent points for the range", () => {
    const ten = pts([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    expect(sliceRange(ten, "7D").map((p) => p.close)).toEqual([4, 5, 6, 7, 8, 9, 10]);
    expect(sliceRange(ten, "1M")).toHaveLength(10); // fewer points than the range: keep all
  });
});

describe("summarize", () => {
  it("computes change, min, max, average and volatility", () => {
    const s = summarize(pts([10, 11, 9.9, 12]))!;
    expect(s.first).toBe(10);
    expect(s.last).toBe(12);
    expect(s.change).toBeCloseTo(2);
    expect(s.changePct).toBeCloseTo(20);
    expect(s.min).toBe(9.9);
    expect(s.max).toBe(12);
    expect(s.average).toBeCloseTo(10.725);
    expect(s.volatility).toBeCloseTo(12.9095, 3);
  });
  it("handles a single point", () => {
    expect(summarize(pts([5]))).toMatchObject({ change: 0, changePct: 0, volatility: 0, min: 5, max: 5 });
  });
  it("returns null for no points", () => {
    expect(summarize([])).toBeNull();
  });
});
```

`lib/chart.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { buildLinePath } from "./chart";

describe("buildLinePath", () => {
  it("scales values to the box (higher value = smaller y)", () => {
    expect(buildLinePath([1, 2, 3], 100, 50)).toBe("M0,50 L50,25 L100,0");
  });
  it("draws a flat middle line when all values are equal", () => {
    expect(buildLinePath([5, 5], 100, 50)).toBe("M0,25 L100,25");
  });
  it("handles one value and no values", () => {
    expect(buildLinePath([7], 100, 50)).toBe("M0,25");
    expect(buildLinePath([], 100, 50)).toBe("");
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run lib/analysis.test.ts lib/chart.test.ts`
Expected: FAIL (modules not found).

- [ ] **Step 3: Implement `lib/analysis.ts` and `lib/chart.ts`** with the interfaces above. No Next.js imports in either file (they must stay testable in plain Node).

- [ ] **Step 4: Verify**

Run: `npx vitest run && npx eslint . && npx tsc --noEmit`
Expected: all tests pass, both commands exit 0.

- [ ] **Step 5: Commit**

```bash
git add lib/analysis.ts lib/analysis.test.ts lib/chart.ts lib/chart.test.ts
git commit -m "Add tested history parsing, range stats and chart path math"
```

---

### Task 3: Data layer for any pair

**Files:**
- Create: `lib/history.ts`
- Modify: `lib/quotes.ts`, `app/api/quotes/route.ts`, `app/api/quotes/[pair]/route.ts`, `app/favorites/page.tsx`

**Interfaces:**
- Consumes: `PAIRS`, `FEATURED_PAIRS`, `findCurrency` (Task 1); `parseHistory`, `PricePoint` (Task 2)
- Produces:
  - `getHistory(pair: string): Promise<PricePoint[]>` in `lib/history.ts`
  - `getQuotes(pairs: string[] = FEATURED_PAIRS): Promise<{ quotes: Quote[]; fetchedAt: number }>` (same return shape as today, so existing callers keep working)
  - `getQuote(pair: string): Promise<Quote | undefined>`

- [ ] **Step 1: Implement `getHistory`**

`"use cache"`, `cacheLife("hours")`, `cacheTag("history")`. Throws `Error("Unsupported pair")` if `pair` is not in `PAIRS` (defense in depth). Fetches `https://economia.awesomeapi.com.br/json/daily/${pair}/360` with `signal: AbortSignal.timeout(5000)`; throws on `!res.ok`; returns `parseHistory(await res.json())`.

- [ ] **Step 2: Generalize `getQuotes` and `getQuote`**

- `getQuotes(pairs)`: throws `Error("Unsupported pair")` if any pair is not in `PAIRS`; keeps `"use cache"`, `cacheLife("minutes")`, `cacheTag("quotes")` and the 5s timeout; requests `/json/last/${pairs.join(",")}`; **skips** pairs missing from the response instead of crashing; `currency` = `findCurrency(pair)!.label`.
- `getQuote(pair)`: uppercase it; return `undefined` if not in `PAIRS`; otherwise `(await getQuotes([pair])).quotes[0]`.

- [ ] **Step 3: Update callers**

- `app/api/quotes/route.ts`: after validation, call `getQuotes(requested?.length ? requested : undefined)` and return its `quotes` as `data` (remove the local filter).
- `app/favorites/page.tsx`: call `getQuotes(favorites)` only when `favorites.length > 0`, so favorites outside the featured four show up.
- `app/api/quotes/[pair]/route.ts`: no logic change needed if it already uses `getQuote`.

- [ ] **Step 4: Verify**

Run: `npx vitest run && npx eslint . && npx tsc --noEmit`, then:
- `curl -s "http://localhost:3000/api/quotes?pairs=JPY-BRL,CHF-BRL"` → `200` with 2 quotes labeled "Japanese Yen (JPY)" and "Swiss Franc (CHF)"
- `curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/api/quotes/JPY-BRL` → `200`
- `curl -s -o /dev/null -w "%{http_code}" "http://localhost:3000/api/quotes?pairs=XYZ-BRL"` → `400`

- [ ] **Step 5: Commit**

```bash
git add lib/history.ts lib/quotes.ts app/api/quotes/route.ts "app/api/quotes/[pair]/route.ts" app/favorites/page.tsx
git commit -m "Fetch cached daily history and quotes for any catalog pair"
```

---

### Task 4: Chart, ranges and analysis on the detail page

**Files:**
- Create: `components/PriceChart.tsx`, `components/RangeTabs.tsx`
- Modify: `app/currency/[pair]/page.tsx`

**Interfaces:**
- Consumes: `findCurrency` (Task 1); `parseRange`, `sliceRange`, `summarize`, `RANGES`, `Range`, `PricePoint` (Task 2); `buildLinePath` (Task 2); `getHistory` (Task 3); existing `FavoriteStar`, `formatBRL`
- Produces:
  - `PriceChart({ points }: { points: PricePoint[] })`: Server Component. `<svg viewBox="0 0 640 200" preserveAspectRatio="none" class="h-48 w-full" role="img">` with one `<path>` from `buildLinePath(closes, 640, 200)`, `fill="none"`, `vectorEffect="non-scaling-stroke"`, stroke green (`text-green-600` via `stroke="currentColor"`) when the last close ≥ the first, red otherwise. `aria-label`: `Price chart from {first date} to {last date}`. Under the chart, the first and last dates at the left and right edges.
  - `RangeTabs({ pair, active }: { pair: string; active: Range })`: one `<Link href={\`/currency/${pair}?range=${r}\`}>` per range in `RANGES`; the active one gets `aria-current="page"` and a filled style.

- [ ] **Step 1: Build `PriceChart` and `RangeTabs`** as specified above.

- [ ] **Step 2: Update the detail page**

Keep the current structure: `CurrencyPage` stays synchronous and renders the Back link plus `<Suspense fallback={<QuoteDetailsSkeleton />}>`. Rename the inner component to `CurrencyDetails({ params, searchParams })`, which:
1. Awaits `params` and `searchParams`; `range = parseRange(typeof sp.range === "string" ? sp.range : undefined)`.
2. `currency = findCurrency(pair)`; `notFound()` if missing.
3. `history = await getHistory(currency.pair)`. If `history.length === 0`, render the heading plus `No price history available for this currency.` and stop.
4. `points = sliceRange(history, range)`, `summary = summarize(points)!`.
5. Renders: `<h1>{currency.label}</h1>` with `<FavoriteStar pair={currency.pair} />`; the latest close `formatBRL(history.at(-1)!.close)` with `Latest close on {date}`; `<RangeTabs>`; `<PriceChart points={points} />`; a stats grid with **Change** (`formatBRL(summary.change)` and `summary.changePct.toFixed(2)%`, green or red), **Low** (`min`), **High** (`max`), **Average**, **Volatility** (`${summary.volatility.toFixed(2)}% / day`).

Remove the old `getQuote` import from this page. Reading `searchParams` must stay inside the Suspense child (Cache Components rule).

- [ ] **Step 3: Verify**

Run: `npx eslint . && npx tsc --noEmit`, then:
- `curl -s "http://localhost:3000/currency/USD-BRL?range=7D"` → `200`, contains `<path` with a `d="M`, `aria-current="page"` and `Volatility`
- `curl -s -o /dev/null -w "%{http_code}" "http://localhost:3000/currency/JPY-BRL?range=abc"` → `200` (falls back to 1M)
- The HTML has no `NaN`: `curl -s "http://localhost:3000/currency/BTC-BRL?range=1Y" | grep -c NaN` prints `0`

- [ ] **Step 4: Commit**

```bash
git add components/PriceChart.tsx components/RangeTabs.tsx "app/currency/[pair]/page.tsx"
git commit -m "Show price chart, range tabs and period analysis on currency pages"
```

---

### Task 5: Search page and navigation

**Files:**
- Create: `app/currencies/page.tsx`, `components/CurrencySearch.tsx`
- Modify: `app/layout.tsx` (nav link), `app/page.tsx` (link under the subtitle)

**Interfaces:**
- Consumes: `CATALOG`, `filterCurrencies`, `Currency` (Task 1)
- Produces:
  - `/currencies` page: Server Component with `metadata.title = "All currencies"`, an `<h1>All currencies</h1>`, and `<CurrencySearch currencies={CATALOG} />`.
  - `CurrencySearch({ currencies }: { currencies: Currency[] })`: `"use client"`, `useState` query, a labeled `<input type="search">` ("Search by name or code"), the result count in a `role="status"` element (`{n} currencies`), and a list of `<Link href={\`/currency/${c.pair}\`}>{c.label}</Link>`. When nothing matches: `No currency matches "{query}".`

- [ ] **Step 1: Build the page and the search component** as specified.

- [ ] **Step 2: Add navigation**

- `app/layout.tsx`: add an `All currencies` link to `/currencies` next to `Favorites`.
- `app/page.tsx`: under the subtitle, a link `Browse all 52 currencies →` to `/currencies`.

- [ ] **Step 3: Verify**

Run: `npx eslint . && npx tsc --noEmit`, then `curl -s http://localhost:3000/currencies` → `200`, contains `Japanese Yen (JPY)` and `52 currencies`.

- [ ] **Step 4: Commit**

```bash
git add app/currencies/page.tsx components/CurrencySearch.tsx app/layout.tsx app/page.tsx
git commit -m "Add searchable list of all currencies"
```
