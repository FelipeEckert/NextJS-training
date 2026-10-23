# Wallet: history, search, charts and analysis

## Goal

Turn the 4-currency dashboard into a "wallet"-style explorer: every currency AwesomeAPI quotes
against BRL can be searched, and each one has a price chart and period analysis.

## What the user gets

1. **Search** (`/currencies`): all 52 currencies quoted in BRL, filtered as you type by code or
   English name ("yen", "JPY"). Each result links to its detail page.
2. **History chart** on `/currency/[pair]`: a line chart of daily closing prices.
3. **Ranges:** 7D, 1M, 3M, 1Y, picked with links that set `?range=` (default `1M`).
4. **Analysis for the selected range:** change (R$ and %), min, max, average and daily
   volatility (standard deviation of day-to-day % changes).
5. **Favorites work for any of the 52 currencies**, and the favorites page shows them all.

## Facts from the API (probed 2026-10-23)

- `GET /json/daily/{PAIR}/{N}` returns daily items, **newest first**, at most **360** items
  (~1 year). Each item has `bid` and `timestamp` (Unix seconds) as strings; only the first item
  also has `code`, `name` and `create_date`.
- Date-range queries (`?start_date=&end_date=`) return a single item, so **more than one year of
  history is not available**. The longest range is 1Y (360 points).
- Unknown pair → HTTP 404 `{"code":"CoinNotExists"}`.
- `GET /json/available` lists 52 `XXX-BRL` pairs. Names are in Portuguese, so the app ships its
  own static English catalog (see the plan).

## Constraints

- English UI copy. Prices are BRL formatted with `formatBRL` (en-US, `R$5.04`).
- Next.js 16.4 with Cache Components: read the bundled docs in `node_modules/next/dist/docs/`
  before writing code (AGENTS.md).
- Charts are server-rendered SVG: no chart library, no client JavaScript for the chart.
- One upstream history call per pair per hour at most (`"use cache"` + `cacheLife("hours")`).
- Every pair a user can send is validated against the static catalog (allowlist), including in
  `proxy.ts`, Server Actions and API routes.

## Out of scope

- Holdings / portfolio balances (amounts owned, total wallet value).
- History beyond one year, intraday charts, chart tooltips.
