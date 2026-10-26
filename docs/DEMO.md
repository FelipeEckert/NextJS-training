# Demo script

A 5-minute walkthrough for showing the project live.

**Live app:** https://next-js-training-ten-gamma.vercel.app

## Before you start

- [ ] Your own account, signed up at `/signup`. You create the API key live in step 6, so keep that page ready; the key is shown once. The shared demo account cannot create keys.
- [ ] A terminal open in the repo folder, with `python` available.
- [ ] An open pull request, or a recent one, to show the CI checks.
- [ ] Browser tabs ready: the live app, `/docs/api`, the pull request, and its Vercel preview link.
- [ ] The wallet chart needs a wallet at least one day old. Check the shared demo wallet before you go on. Do not reset it before the talk, because anyone can use it.

## Steps

### 1. Home, sign in, demo wallet (about 30 s)

1. Open the live URL and point at the live rates on the home page.
2. Click **Sign in** (top right), then **Try the demo**. You land on `/wallet`.

> "Every account starts with R$ 100,000 of virtual cash. The demo account is shared, so one click is enough, with no password."

Code: `app/page.tsx`, `app/login/page.tsx`, `app/auth-actions.ts` (`tryDemo`), `lib/users.ts` (`ensureDemoUser`).

### 2. Trade on the currency page (about 45 s)

1. Open `/currency/USD-BRL`. Under the price, choose **Buy**, type `100` in the amount and click **Buy**.
2. Choose **Sell**, tick **Sell all**, and click **Sell**.
3. Point at the result line under the form. It shows the amount, the exact fill price (up to 10 decimals) and the time in Brasília.

> "Buys fill at the ask and sells at the bid, so the spread is the house's edge. Rounding always goes down."

Code: `components/TradeForm.tsx`, `app/trade-actions.ts` (`trade`, `describeTrade`), `lib/money.ts` (`planTrade`).

### 3. Wallet (about 45 s)

1. Open **Wallet**. Point at total value, return since the wallet started, and the positions with average cost and profit or loss.
2. Scroll to the value chart and the trade history (the latest 100 trades).
3. Click **Reset wallet**. It asks "Reset to R$ 100,000?" and needs a second click. Click **Cancel**, because a reset would affect the shared demo for everyone.

> "The chart is not stored. It is rebuilt by replaying every trade over the daily closes."

Code: `app/wallet/page.tsx`, `lib/portfolio.ts`, `lib/portfolio-history.ts`, `components/ResetWalletButton.tsx`, `app/trade-actions.ts` (`resetWalletAction`).

### 4. Leaderboard (about 20 s)

1. Open `/leaderboard`. It lists the top 10 accounts by return, with username, total value and return.

> "It is public. The demo account is left out, so the shared wallet can't take a spot."

Code: `app/leaderboard/page.tsx`, `lib/leaderboard.ts` (`rankWallets`), `lib/leaderboard-data.ts` (excludes `DEMO_USERNAME`).

### 5. Backtest (about 40 s)

1. Open `/backtest`. Keep the currency USD-BRL and choose the **Buy the dip** strategy with the default settings (drop 2%, lookback 5 days, take profit 3%). Click **Run backtest**.
2. Point at the strategy row against the **Buy and hold** row, and at the equity chart. Copy the page's URL: the settings are in it, so the result is a shareable link.

> "It runs over the last year of daily closes, starting from R$ 100,000, with no spread or fees. It never touches a wallet."

Code: `app/backtest/page.tsx`, `lib/backtest.ts` (`runBacktest`, `parseBacktestParams`), `lib/history.ts`.

### 6. API: a key, two identical orders, a bot (about 1 min 30 s)

1. On `/settings/api-keys` (your own account), enter a name and click **Create key**. Copy it, then run `export API_KEY=ptk_...` in the terminal.
2. Check the wallet:

   ```bash
   BASE=https://next-js-training-ten-gamma.vercel.app
   curl -H "Authorization: Bearer $API_KEY" "$BASE/api/v1/wallet"
   ```

3. Send the same order twice with one `Idempotency-Key`. Use a new UUID for each run: if the first call returns 200, that key was already used on this account, so pick another.

   ```bash
   IDEM=$(python -c "import uuid; print(uuid.uuid4())")
   ORDER='{"pair":"USD-BRL","side":"buy","brl":"100.00"}'
   for i in 1 2; do
     curl -s -w " %{http_code}\n" -X POST "$BASE/api/v1/orders" \
       -H "Authorization: Bearer $API_KEY" -H "Idempotency-Key: $IDEM" \
       -H "Content-Type: application/json" -d "$ORDER"
   done
   ```

   The first response is `201` and the second is `200`, with the same `id`.

4. Optional: reuse the same key with a different amount, for example `"brl":"200.00"`. The API returns `422 IDEMPOTENCY_MISMATCH`.
5. Run the bot:

   ```bash
   python examples/bot.py
   ```

   It prints either a trade or "Holding steady", depending on the current averages.

> "The retry is safe because the server stores the key and a hash of the order. The bot runs on my machine, and the server only sees HTTP requests with the key."

Open `/docs/api` for the full reference.

Code: `app/settings/api-keys/page.tsx`, `components/NewApiKeyForm.tsx`, `app/api-key-actions.ts`, `lib/api-keys.ts`, `lib/api.ts` (`withApiKey`), `app/api/v1/wallet/route.ts`, `app/api/v1/orders/route.ts`, `lib/trading.ts` (`executeTrade`), `examples/bot.py`, `app/docs/api/page.tsx`.

### 7. CI and deploys (about 30 s)

1. Open the pull request. Show the three checks: `checks` (lint, typecheck, unit tests, build), `db` (database tests on Postgres 17) and `smoke` (the app running against seeded data, with its key pages requested).
2. Open the Vercel preview link on the pull request.

> "Merging to main deploys production. Branch protection, set in GitHub, requires a pull request, the three checks and a squash merge. Migrations run before the new code goes live."

Code: `.github/workflows/ci.yml`, `vercel.json` (build runs `db:migrate` first), `scripts/smoke.mjs`.

## Likely questions

**Why integer cents and bigint quantities?**
Floats cannot store most decimal amounts exactly, so totals drift by fractions of a cent. BRL is kept as integer cents, and quantities and prices as 10-decimal fixed-point `bigint`s, so the math is exact and any remainder is rounded down. Postgres stores cents as `bigint` and quantities as `numeric(30, 10)`.
File: `lib/money.ts`, `lib/db/schema.ts`.

**How do you prevent double-spending?**
Each trade runs in one transaction that locks the wallet row with `SELECT ... FOR UPDATE`. A second buy waits for the first, then checks the cash that is left. The test "lets only one of two simultaneous buys spend the same cash" covers it.
File: `lib/trading.ts` (`executeTrade`), `lib/trading.db.test.ts`.

**How are retries safe?**
A unique index on (user, idempotency key) stores each trade, along with a hash of the order. The same key and the same order return the stored trade (`200`), and the same key with a different order returns `422`. One caveat: the quote is fetched before the lookup, so a retry made while prices are down returns `503` instead of the stored trade. No second trade is created.
File: `lib/trading.ts`, `app/api/v1/orders/route.ts`, `drizzle/0000_great_blue_marvel.sql`.

**Why scrypt for passwords but SHA-256 for API keys?**
People choose passwords, so they can be guessed, and scrypt is deliberately slow and memory-hard to make guessing expensive. An API key is 32 random bytes, so guessing is hopeless and a fast hash is enough. The database stores only the SHA-256 hash, so a leaked table does not expose usable keys.
File: `lib/password.ts`, `lib/api-keys.ts`.

**How does the lockout hold against parallel guesses?**
Each login attempt claims a numbered slot with one atomic `UPDATE`, before the password is checked. Parallel guesses get different slots, so a burst cannot slip more than the allowed failures past the lock. The database tests cover a parallel burst.
File: `lib/users.ts` (`verifyLogin`), `lib/users.db.test.ts`.

**What does the smoke test catch that `next build` doesn't?**
The build does not render request-time pages, and some mistakes only fail when a page runs. Example: the Postgres driver uses `crypto.getRandomValues()`, which Next blocks during prerendering and runtime prefetch, so a page that reads the database must first call `await connection()`. The smoke test starts `next dev` and requests the real pages, so it fails if that call is missing. Commit `a703f3b`, on the `test/smoke-regression` branch, removed the call on purpose to prove the job catches it.
File: `scripts/smoke.mjs`, `components/TradePanel.tsx`, `.github/workflows/ci.yml`.

**What would you do next?**
Three open issues: a house bot that trades daily through the public API (#28), end-to-end tests with Playwright in CI (#29), and side-by-side comparison of backtest strategies (#30).
File: `examples/bot.py` (for #28), `.github/workflows/ci.yml` (for #29), `lib/backtest.ts` (for #30).

**What are the known limits?**
- Logout only deletes the cookie. Sessions are signed tokens with no server record, so a copied cookie stays valid until it expires after 7 days. A session table, or a version number on the user, would fix this.
- Quote and history caches live in each server instance. On Vercel, each instance calls AwesomeAPI on its own, so a shared cache is needed when traffic grows.
- Rate-limit windows are never deleted, and two simultaneous key creations can exceed the limit of 3 keys.
File: `lib/session.ts`, `lib/session-token.ts`, `lib/quotes.ts`, `lib/history.ts`, `lib/rate-limit.ts`, `lib/api-keys.ts`.
