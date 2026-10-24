# Paper Trading Simulator — Design

Status: approved in conversation (grilling rounds 1–4), 2026-10-24. Calls marked **(builder's call)** or **(Claude's call)** were not decided by Felipe.

## Why

Felipe's interview fell through; he is turning this exchange-rate dashboard into a portfolio showcase for Next.js / back-end roles. A recruiter spending 2 minutes on it should see: real accounts, correct money logic, a strategy backtester, and a public API that people's own bots/ML models can trade through — shipped with a professional GitHub flow (PRs, CI, preview deploys). Deadline: **1 week**.

## Goals

Three phases, each shipped to production before the next starts.

1. **Accounts and paper wallet** (days 1–3)
2. **Strategy backtester** (day 4)
3. **Bot trading API** (days 5–6)

Day 7: bug fixes, final review, recruiter-facing README.

## Non-goals

E-mail, password reset, account deletion, social login, OpenAPI spec, favorites in the database (favorites stay in the cookie; two accounts in one browser share them), running user code on our server, Claude/LLM features, multiple wallets per user, shorting, leverage, fees, Dependabot/CodeQL, release tags.

## Anti-goals (failure even if it "works")

- Money that can be created or lost by rounding, double clicks, retries, or races.
- A secret (password, API key, session secret) that is stored in plain text, logged, or sent to the browser.
- A production deploy that breaks because a migration or build needs something CI didn't check.
- Code nobody asked for (ponytail: smallest complete change; `shortcut:` comments for known limits).

## Constraints

- Next.js **16.4.2** with `cacheComponents` and `partialPrefetching` on. APIs differ from older Next.js: read `node_modules/next/dist/docs/` before writing Next.js code (AGENTS.md).
- Keep existing conventions: zod at every trust boundary, `import "server-only"` on secret-holding modules, English for UI/code/docs, short "why" comments, `shortcut:` comments.
- All existing pages and `/api/quotes*` endpoints keep working.
- Database: **Neon Postgres + Drizzle ORM**. Separate Neon branches: `main` (production) and `dev` (local + previews).
- `next build` must pass with **no secrets and no database** (CI builds without them). Database and secrets are read lazily, at request time.
- Node 24 locally; CI uses Node 24.

## Phase 1 — Accounts and wallet

### Accounts

- Sign up at `/signup` with **username + password**. Username: 3–20 chars, `[a-z0-9_]`, stored lowercase, unique. Password: 8–200 chars.
- Passwords hashed with **`scrypt` from `node:crypto`**, random per-user salt, compared with `timingSafeEqual`. No new auth library.
- Login: generic error ("Invalid username or password.") for every failure. Unknown usernames still run one scrypt so timing doesn't reveal which usernames exist.
- **Lockout:** 5 consecutive failed logins lock that account for 15 minutes; a success resets the counter. During lockout, login fails with the same generic error.
- Session: the existing signed cookie, now carrying the **user id** instead of the username (`<userId>.<expiresAt>.<signature>`). Old cookies simply stop validating.
- The **`demo` account** is an ordinary account, created automatically if missing, shared by everyone; anyone can reset its wallet. Visitors enter it with a **"Try the demo" button** on the login page — one click, no password. The demo account has no usable password (it can't be logged into or locked out through the form). `DEMO_PASSWORD` is removed.
- Header shows the logged-in username, Sign in / Sign up / Log out.

### Wallet rules

- New account (and every reset) starts with **R$ 100,000.00** cash and nothing else.
- Cash stored as **integer cents** (`bigint`). Currency quantities stored as Postgres **`numeric`** (enough decimals for BTC; builder picks the precision, at least 10 decimals). Never store money as float.
- **Buy:** user types an amount in BRL (min **R$ 1.00**, max = cash). Executes at the quote's **`ask`**. Quantity = amount / ask, rounded **down** at the stored precision.
- **Sell:** user types a quantity, or "Sell all". Executes at **`bid`**. Proceeds rounded **down** to whole cents. Quantity must be > 0 and ≤ held. Selling a position to zero removes it.
- All rounding favors the house, so no sequence of trades can create money.
- **Average cost** per position is tracked (cost basis in cents). Selling reduces cost basis proportionally.
- No negative cash, no shorting, no leverage, no fees.
- **Price source:** the existing `getQuotes` cache (≤ ~1 min old). The `Quote` type gains `bid` and `ask`. Freshness is judged by **`fetchedAt`** (when we called the API), not the API's `create_date` — fiat markets are closed on weekends, and Friday's price is the right price then **(Claude's call)**. If `fetchedAt` is older than **2 minutes** (stale-while-revalidate after idle), or AwesomeAPI is down, the order is **rejected** with 503 ("price unavailable, try again") — never filled at an old price. That read already triggers the background refresh, so a retry a few seconds later succeeds. A pair whose `bid`/`ask` is missing, zero or not a finite number is untradable (503) until the API returns it. All 52 pairs are tradable; during an outage that falls back to featured pairs only, the others are untradable. The order result shows the exact price and time used.
- **Concurrency:** every trade runs in one database transaction that locks the user's wallet row (`SELECT … FOR UPDATE`), re-checks the rules, and writes the trade, position, and cash together. Two simultaneous orders can never spend the same money.
- **Reset wallet:** deletes the user's trades and positions, sets cash back to R$ 100,000, and sets `started_at = now`. Confirmation step before resetting.
- **Valuation:** a position is worth `quantity × current bid` (what selling now would pay). Total value = cash + positions. Return % = (total − 100,000) / 100,000.

### Pages

- **`/wallet`** (login required): total value, return % since `started_at`, cash, positions table (currency, quantity, average cost, current value, P/L in R$ and %, link to the currency page), the portfolio chart, the trade history, and Reset.
- **Portfolio chart:** daily total value since `started_at`, **computed on request** from trades + the existing cached daily history (no stored snapshots, no cron). Limited to the history the app already has (~1 year). Reuses `PriceChart`.
- **Trade history:** all trades, newest first — date, currency, buy/sell, quantity, price, total. No filters.
- **Buy/Sell form on `/currency/[pair]`**, next to the chart. Logged-out visitors see "Sign in to trade". Shows cash available and the position held. Submit button disabled while pending. Each rendered form carries a hidden, randomly generated **idempotency key**, so the same form submission can never trade twice (double click, resend) — the web and the API share the same idempotency column and trade function **(Claude's call)**. Two separate forms (two tabs) are two separate orders, by design.
- **`/leaderboard`** (public): top 10 users by return %, username only, **`demo` excluded** (shared and resettable, so its return means nothing) **(Claude's call)**. Computed on request with the cached quotes. *(shortcut acceptable at this scale.)*
- **Quotes unavailable:** `/wallet` still renders from the database — cash, positions with quantity and average cost, history — and shows "price unavailable" instead of current values, P/L, total and return. `/leaderboard` shows "temporarily unavailable". Never a crash page **(Claude's call)**.
- **Sign-up limit:** at most **5 sign-ups per IP per hour** (Vercel's `x-forwarded-for`), reusing the Postgres rate-limit counter from Phase 3 (Phase 1 builds the counter; Phase 3 reuses it) **(Claude's call)**. Offensive usernames on the leaderboard are an accepted risk (no moderation).
- `proxy.ts` optimistic redirect to `/login?next=` extends to `/wallet` and `/settings`.

## Phase 2 — Backtester

- **`/backtest`**, public, no login, never touches any wallet.
- The user picks a currency, a strategy, and its numbers. The form state lives in the **URL search params**, so a result is a shareable link. The page computes on the server with pure functions.
- Simulation: the **last year** (same calendar-day cut as the 1Y chart) of daily prices from `getHistory`, starting with R$ 100,000 virtual cash. All-in / all-out. Trades at the daily price, **no spread** (the daily history only has `bid`) **(Claude's call)**.
- Strategies:
  1. **Buy and hold** — buy on day 1, hold. Always shown as the benchmark.
  2. **Buy the dip** — when flat: buy if the price fell ≥ X% versus N days ago. When holding: sell when the price is ≥ Y% above the entry price.
  3. **Moving-average crossover** — hold while the short MA (S days) is above the long MA (L days); sell when it crosses back below. Requires S < L.
- Parameters validated with zod, with sensible ranges (builder's call); invalid input shows a message, never a crash.
- Result: final value, return %, number of trades, max drawdown, and an equity chart against buy-and-hold.

## Phase 3 — Bot trading API

People run their own algorithm/ML model **on their own computer** and trade their wallet through a public API. Our server never runs their code.

- **API keys page** (`/settings/api-keys`, login required): create a key (with a name), list keys (name, prefix, created, last used), revoke. Max **3** active keys. The **`demo` account cannot create keys** (a shared account would let strangers run bots on it) **(Claude's call)**. The full key is shown **once**; the database stores only its **SHA-256 hash** (fine for long random keys, unlike passwords).
- Auth: `Authorization: Bearer <key>`. **Every** `/api/v1/*` endpoint requires a key.
- Bots trade the **same wallet** as the user's web account, under the exact same rules and the same trade function as the web form.
- Endpoints:
  - `GET /api/v1/quotes` — current quotes with `bid`, `ask`, time
  - `GET /api/v1/history/{pair}` — last year of daily prices
  - `GET /api/v1/wallet` — cash, positions, total value, return %
  - `POST /api/v1/orders` — buy: `{ "pair", "side": "buy", "brl": "250.00" }`; sell: `{ "pair", "side": "sell", "quantity": "0.5" | "all" }`. Amounts as strings to avoid float precision loss **(Claude's call: explicit field names instead of one overloaded `amount`)**.
  - `GET /api/v1/orders` — the user's trades, newest first, `?limit=` up to 100 (no cursor pagination).
- **Idempotency:** `POST /api/v1/orders` **requires** an `Idempotency-Key` header (1–100 chars). Stored on the trade, unique per user. Same key + same body → returns the original result, no second trade. Same key + different body → `422`. Rejected orders are not stored, so a retry is re-evaluated. Keys from before a reset may be reused after it.
- **Rate limit:** **60 requests per minute per key**, counted in Postgres (fixed one-minute window). Over the limit → `429` with `Retry-After`. Responses include `X-RateLimit-Remaining`.
- Errors are JSON `{ "error": { "code", "message" } }`: `400` invalid input, `401` missing/invalid/revoked key, `404` unknown pair, `422` rule violation (insufficient cash/quantity, below minimum, idempotency mismatch), `429`, `503` price unavailable.
- No CORS (bots call from servers/scripts, not browsers).
- **`/docs/api`**: every endpoint with a `curl` example, the error format, limits, and idempotency.
- **`examples/bot.py`**: about 50 lines, **Python standard library only** (no `pip install`), moving-average crossover, reads `API_KEY` and `BASE_URL` from env, works against the live site.

## CI/CD and GitHub flow

- **One small/medium task = one branch = one pull request.** Branch names like `feat/p1-schema`, always cut from the latest `main`. Tasks are done one at a time.
- Per task: implement → task review → push → open PR (description + preview link) → CI green → Claude sends Felipe the PR link → **Felipe reviews and squash-merges** → the next task starts from the updated `main`.
- **Branch protection on `main`:** PR required, CI must pass, no direct pushes (turned on as soon as the CI workflow has run once).
- **GitHub Actions** (`.github/workflows/ci.yml`) on every PR and on push to `main`: install, lint, type-check (`tsc --noEmit`), unit tests, `next build` (no secrets), and the **database tests** against a **Postgres service container** with migrations applied.
- **Vercel** (already connected to the repo): every PR gets a **preview deploy** (using the Neon `dev` branch); merging to `main` deploys **production**.
- **Migrations:** Drizzle migration SQL files are committed. They run during the Vercel build (`npm run db:migrate && npm run build` via the Vercel build command), against that environment's `DATABASE_URL`. Migrations must stay backward-compatible (add, don't break). The plain `npm run build` (CI) does not migrate.
- **Database driver (Claude's call, revised from the grilling summary):** `pg` (node-postgres) with `drizzle-orm/node-postgres` and Neon's pooled connection string — instead of Neon's WebSocket driver. Same row-locking transactions, and it lets CI test against a plain Postgres container.
- **External setup (Felipe, guided, before the first database task):** create the Neon database from Vercel → Storage, which sets `DATABASE_URL` for Production and Preview; create the `dev` branch in Neon and put its URL in `.env.local` and in Vercel's Preview environment; set the Vercel build command. Already in place: the GitHub repo (public, Actions available) connected to Vercel. Previews share the one `dev` branch — safe because tasks are merged one at a time and migrations are additive.
- Env vars: `DATABASE_URL` (new), `SESSION_SECRET`, `AWESOMEAPI_KEY`. `DEMO_PASSWORD` is removed. `.env.example` lists them.

## Testing

- **Unit (Vitest), pure logic:** trade math and rules (rounding down, minimum, insufficient cash/quantity, sell all, average cost), valuation and return %, portfolio-history reconstruction, the three backtest strategies and max drawdown, rate-limit window math, API-key format/hashing, password hash/verify.
- **Database tests** (separate command, run in CI against the Postgres container): two simultaneous buys that each spend 60% of the cash → exactly one succeeds; idempotent order replay; rate limit returns 429 on request 61; lockout after 5 failures.
- Existing 24 tests keep passing.

## Left to the builder

Table and column names, file layout (following the existing `lib/` + `app/` + `components/` pattern), numeric precision (≥ 10 decimals), parameter ranges for strategies, page layout and styling (match the current Tailwind look), leaderboard tie-breaking, how the DB tests are separated from unit tests.

## Decisions from the builder check (Felipe)

1. Demo login: a "Try the demo" button, no password.
2. Felipe merges every PR himself after reviewing it; Claude opens the PR and sends the link.
3. Branch protection on `main`: yes.
