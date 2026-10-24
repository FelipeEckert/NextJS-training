# Paper Trading Simulator Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the exchange-rate dashboard into a paper-trading simulator: accounts and a R$ 100,000 virtual wallet, a strategy backtester, and a public API that people's own bots trade through — shipped through GitHub PRs with CI.

**Architecture:** Neon Postgres via Drizzle (`pg` driver). Pure logic (money math, trade rules, valuation, backtests) lives in dependency-free `lib/*.ts` files with unit tests; thin `server-only` modules do the database work inside row-locking transactions; Server Actions (web) and `/api/v1` Route Handlers (bots) share the same trade function.

**Tech Stack:** Next.js 16.4.2 (Cache Components), React 19.3, TypeScript, Tailwind 4, zod 4, Drizzle ORM 0.45 + drizzle-kit 0.31 + pg 8, Vitest 4, GitHub Actions, Vercel.

**Spec:** `docs/superpowers/specs/2026-10-24-paper-trading-design.md`

## Global Constraints

- Next.js 16.4.2 differs from older versions: before writing Next.js code, read the matching guide in `node_modules/next/dist/docs/` (AGENTS.md). Follow existing patterns in this repo (`PageProps`, `RouteContext`, `useActionState`, `"use cache"`).
- `next build` must pass with **no `DATABASE_URL` and no `SESSION_SECRET`**. Read env vars lazily inside functions, never at module top level. A page that reads the database **without first reading cookies, headers, params or searchParams** must call `await io()` (from `next/cache`) first, exactly like `app/page.tsx`.
- `crypto.randomUUID()`, `Date.now()`, `new Date()` may not run during prerender: only after a request-time API (cookies/headers/searchParams/`io()`), in a Server Action, in a Route Handler, or in a browser event handler.
- Money: BRL as **integer cents** (`number`). Quantities and prices in logic as **`bigint` fixed-point with 10 decimals** (`QTY_SCALE = 10`). In Postgres: cents `bigint` (mode `"number"`), quantities/prices `numeric(30, 10)` (Drizzle returns strings). Never store or accumulate money in floats. Floats are allowed only for display, charts, percentages, and the backtest simulation (Task 14).
- All rounding favors the house (round **down** what the user receives).
- Modules that touch the database or secrets start with `import "server-only";`. Pure logic files import nothing from Next.js or the database.
- zod at every trust boundary (form data, JSON bodies, search params, headers). Auth errors are generic.
- English for UI, code, and comments. Comments only for the "why", one line. Known limits get `// shortcut: <limit>, <when to upgrade>`.
- UI matches the existing Tailwind look: `zinc` palette, `rounded-xl border border-zinc-200 dark:border-zinc-800` cards, `tabular-nums` for numbers, red/green for losses/gains.
- Constants: `STARTING_CASH_CENTS = 10_000_000`, `MIN_BUY_CENTS = 100`, `QTY_SCALE = 10`, `DEMO_USERNAME = "demo"`, lockout `5` failures → `15` minutes, sign-up limit `5` per IP per hour, API limit `60` per key per minute, max `3` API keys, quote max age `120_000` ms.
- Every task finishes with all of these green: `npm run lint`, `npm run typecheck`, `npm test`, `npm run build` — plus `npm run test:db` for tasks that touch the database.
- Git: the controller creates the task branch before dispatch. Implementers commit on the current branch only — never push, never switch or create branches. Commit messages end with exactly this trailer and no other: `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

1. **Tiny and huge amounts** — R$ 1.00 of BTC, selling dust, 10-decimal quantities, R$ 100,000 of a ~0.0003 BRL currency: a buy followed by an immediate sell at the same price must never return more cash than was spent. Pinned in Task 3.
2. **Messy numeric input** — `"1e3"`, `"-5"`, `""`, `" 10 "`, `"10,50"`, `"0.000000000001"`, `"10.555"` (BRL): clear rejection or exact parse, never NaN. Pinned in Task 3.
3. **Retries and races** — the same idempotency key sent twice at once, two different orders at once: one trade / no overspend. Pinned in Task 9.
4. **Quotes unavailable** — AwesomeAPI down or the cache stale: orders rejected with a retry message, `/wallet` still renders cash and positions. Pinned in Tasks 8 and 11.
5. **Old session cookies** — a pre-change `demo.<exp>.<sig>` cookie must read as logged out, not crash. Pinned in Task 6.

---

## Setup S1 — Neon database (Felipe, guided by the controller; before Task 2's PR is merged)

Not an implementer task. The controller walks Felipe through it in chat:
1. Vercel → project `next-js-training` → Storage → Create → Neon → connect to Production and Preview. This sets `DATABASE_URL` and `DATABASE_URL_UNPOOLED`.
2. Neon console → Branches → create `dev` from `main`. Copy its pooled and unpooled connection strings.
3. Put the `dev` strings in `.env.local` (`DATABASE_URL`, `DATABASE_URL_UNPOOLED`) and override both in Vercel's **Preview** environment.
4. After Task 1 merges, the controller enables branch protection on `main` (PR required; required check `checks`; after Task 2 also `db`).

---

## Phase 1 — Accounts and wallet

### Task 1: CI workflow

**Files:**
- Create: `.github/workflows/ci.yml`
- Modify: `package.json` (scripts)

**Interfaces:**
- Produces: script `typecheck` = `tsc --noEmit`; a workflow job named **`checks`**.

- [ ] **Step 1:** Add `"typecheck": "tsc --noEmit"` to `package.json` scripts.
- [ ] **Step 2:** Create `ci.yml`: name `CI`; triggers `pull_request` and `push` to `main`; job `checks` on `ubuntu-latest`: `actions/checkout@v4`, `actions/setup-node@v4` with `node-version: 24` and `cache: npm`, then `npm ci`, `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`. No secrets, no env vars.
- [ ] **Step 3:** Run locally: `npm run lint && npm run typecheck && npm test && npm run build`. Expected: all pass (24 tests).
- [ ] **Step 4:** Commit: `ci: run lint, types, tests and build on every PR`.

### Task 2: Database foundation

**Files:**
- Create: `lib/db/schema.ts`, `lib/db/index.ts`, `lib/db/db.db.test.ts`, `drizzle.config.ts`, `drizzle/` (generated), `vitest.config.ts`, `vitest.db.config.ts`, `test/empty.ts`, `vercel.json`
- Modify: `package.json`, `.env.example`, `.github/workflows/ci.yml`

**Interfaces:**
- Produces:
  - `getDb()` → Drizzle `NodePgDatabase<typeof schema>` singleton; throws `Error("DATABASE_URL is not set")` when missing. `type Db = ReturnType<typeof getDb>`.
  - `closeDb(): Promise<void>` (ends the pool; tests call it in `afterAll`).
  - Tables (export names): `users`, `wallets`, `positions`, `trades`, `rateLimits`.
  - Scripts: `db:generate`, `db:migrate`, `test:db`.

- [ ] **Step 1:** `npm install drizzle-orm pg` and `npm install -D drizzle-kit @types/pg`.
- [ ] **Step 2:** `lib/db/schema.ts` (Drizzle `pg-core`):
  - `users`: `id` serial PK; `username` text not null **unique**; `passwordHash` text **nullable** (the demo has none); `failedLogins` integer not null default 0; `lockedUntil` timestamptz nullable; `createdAt` timestamptz not null default now.
  - `wallets`: `userId` integer PK → `users.id`; `cashCents` bigint mode number not null; `startedAt` timestamptz not null default now.
  - `positions`: `userId` → `users.id`; `pair` text; `quantity` numeric(30,10) not null; `costCents` bigint mode number not null; composite PK (`userId`, `pair`).
  - `trades`: `id` serial PK; `userId` → `users.id` not null; `pair` text not null; `side` text not null (`"buy"`/`"sell"`); `quantity` numeric(30,10) not null; `price` numeric(30,10) not null; `totalCents` bigint mode number not null; `idempotencyKey` text not null; `requestHash` text not null; `createdAt` timestamptz not null default now; unique index (`userId`, `idempotencyKey`); index (`userId`, `createdAt`).
  - `rateLimits`: `bucket` text; `windowStart` timestamptz; `count` integer not null; composite PK (`bucket`, `windowStart`).
- [ ] **Step 3:** `lib/db/index.ts`: `import "server-only"`; lazily creates one `pg` `Pool` from `process.env.DATABASE_URL` and `drizzle({ client: pool, schema })` from `drizzle-orm/node-postgres`. Add `// shortcut: one module-level pool per serverless instance; use Vercel's attachDatabasePool if connections pile up`.
- [ ] **Step 4:** `drizzle.config.ts`: if `.env.local` exists, `process.loadEnvFile(".env.local")`; `defineConfig({ dialect: "postgresql", schema: "./lib/db/schema.ts", out: "./drizzle", dbCredentials: { url: process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL! } })` (migrations need the direct, unpooled connection).
- [ ] **Step 5:** Scripts: `"db:generate": "drizzle-kit generate"`, `"db:migrate": "drizzle-kit migrate"`, `"test:db": "vitest run -c vitest.db.config.ts"`. Run `npm run db:generate`; commit the generated `drizzle/` folder.
- [ ] **Step 6:** `test/empty.ts` = `export {};`. `vitest.config.ts`: `resolve.alias` maps `server-only` → `./test/empty.ts` and `@` → the repo root; `test.exclude` = `[...configDefaults.exclude, "**/*.db.test.ts"]`. `vitest.db.config.ts`: `mergeConfig` of the base with `test.include: ["**/*.db.test.ts"]`, `test.exclude: configDefaults.exclude`, `test.env: loadEnv("", process.cwd(), "")` (from `vite`, loads `.env.local`), `fileParallelism: false`, `testTimeout: 20_000`.
- [ ] **Step 7:** `lib/db/db.db.test.ts`: `select 1` through `getDb().execute(sql\`select 1 as ok\`)` returns `ok = 1`; `afterAll(closeDb)`.
- [ ] **Step 8:** `vercel.json`: `{ "buildCommand": "npm run db:migrate && npm run build" }`. `.env.example`: add `DATABASE_URL=` and `DATABASE_URL_UNPOOLED=` with a one-line comment each.
- [ ] **Step 9:** `ci.yml`: add job **`db`** with service `postgres:17` (`POSTGRES_PASSWORD: postgres`, port 5432, health check `pg_isready`), env `DATABASE_URL=postgres://postgres:postgres@localhost:5432/postgres`; steps: checkout, setup-node 24, `npm ci`, `npm run db:migrate`, `npm run test:db`.
- [ ] **Step 10:** Verify: `npm test` (24 pass, db test not included), `npm run build` with no `DATABASE_URL` set (passes). If `.env.local` has the Neon `dev` URL: `npm run db:migrate && npm run test:db` passes; otherwise report that it was not run locally.
- [ ] **Step 11:** Commit: `feat(db): add Postgres schema, Drizzle setup and DB test job`.

### Task 3: Money math and trade rules (pure)

**Files:**
- Create: `lib/money.ts`, `lib/money.test.ts`

**Interfaces:**
- Produces (all pure, no imports besides types):
  - constants `QTY_SCALE`, `STARTING_CASH_CENTS`, `MIN_BUY_CENTS`
  - `parseDecimal(input: string, scale: number): bigint | null` — trims; accepts only `^\d+(\.\d+)?$`; extra decimals are **truncated**; anything else → `null`.
  - `formatDecimal(value: bigint, scale: number): string` — no trailing zeros (`"1.5"`, `"0"`, `"20"`).
  - `parseBrlToCents(input: string): number | null` — `^\d+(\.\d{1,2})?$` after trim; more than 2 decimals → `null`.
  - `centsToBrl(cents: number): string` — `"1234.50"` (for APIs; UI keeps using `formatBRL`).
  - `toCents(quantity: bigint, price: bigint): number` — value of a quantity at a price, rounded down: `quantity * price / 10n ** 18n`.
  - `type Holding = { quantity: bigint; costCents: number }`
  - `type PlanOrder = { side: "buy"; brlCents: number } | { side: "sell"; quantity: bigint | "all" }`
  - `type TradeErrorCode = "BELOW_MINIMUM" | "INSUFFICIENT_CASH" | "NO_POSITION" | "INSUFFICIENT_QUANTITY" | "AMOUNT_TOO_SMALL"`
  - `planTrade(state: { cashCents: number; holding: Holding | null }, order: PlanOrder, quote: { bid: bigint; ask: bigint }): { ok: true; quantity: bigint; price: bigint; totalCents: number; cashCents: number; holding: Holding | null } | { ok: false; code: TradeErrorCode; message: string }`
  - `returnPct(totalCents: number): number` — `(total − STARTING) / STARTING × 100`.

Rules for `planTrade`:
- Buy: `brlCents < MIN_BUY_CENTS` → `BELOW_MINIMUM`; `brlCents > cashCents` → `INSUFFICIENT_CASH`; quantity = `BigInt(brlCents) * 10n ** 18n / ask`; quantity `0n` → `AMOUNT_TOO_SMALL`; price = ask; totalCents = brlCents; holding quantity and costCents both increase by these amounts.
- Sell: no holding → `NO_POSITION`; `"all"` means the full held quantity; quantity `<= 0n` → `AMOUNT_TOO_SMALL`; quantity > held → `INSUFFICIENT_QUANTITY`; totalCents = `toCents(quantity, bid)`; `0` → `AMOUNT_TOO_SMALL`; price = bid; cost reduced by `floor(costCents × sold / held)`, or the whole cost when selling everything; the remaining holding is `null` when the quantity reaches 0.

- [ ] **Step 1: Write the failing tests** (`lib/money.test.ts`), including exactly:
  - `parseDecimal("5", 10)` → `50000000000n`; `parseDecimal(" 10 ", 2)` → `1000n`; `parseDecimal("0.000000000001", 10)` → `0n`; `parseDecimal` of `"1e3"`, `"-5"`, `""`, `"10,50"`, `"."`, `"1."` → `null`.
  - `formatDecimal(15000000000n, 10)` → `"1.5"`; `formatDecimal(0n, 10)` → `"0"`.
  - `parseBrlToCents("250")` → `25000`; `("250.5")` → `25050`; `("10.555")` → `null`; `("10,50")` → `null`.
  - `centsToBrl(123450)` → `"1234.50"`; `centsToBrl(5)` → `"0.05"`.
  - Buy R$ 100 at ask `"5"`: quantity `200000000000n` (20 units), cash `10_000_000 − 10_000`.
  - Buy R$ 1 of BTC at ask `"600000"`: quantity `16666n`.
  - Round trip: buy R$ 100 at ask `"3"`, then sell `"all"` at bid `"3"` → totalCents `9999` (never more than 10000).
  - Buy R$ 100,000 at ask `"0.0003"` → ok, quantity = `333333333.3333333333` units (`3333333333333333333n`).
  - `BELOW_MINIMUM` for 99 cents; `INSUFFICIENT_CASH` for cash + 1; `NO_POSITION`; `INSUFFICIENT_QUANTITY`; selling `1n` atom at bid `"5"` → `AMOUNT_TOO_SMALL`.
  - Partial sell of half a 20-unit holding with costCents 10000 → remaining costCents 5000; selling all → holding `null`.
  - `returnPct(10_500_000)` → `5`.
- [ ] **Step 2:** `npx vitest run lib/money.test.ts` → FAIL (module missing).
- [ ] **Step 3:** Implement `lib/money.ts`.
- [ ] **Step 4:** `npx vitest run lib/money.test.ts` → PASS; then the full Global Constraints checks.
- [ ] **Step 5:** Commit: `feat: add exact money math and trade rules`.

### Task 4: Passwords and usernames (pure)

**Files:**
- Create: `lib/password.ts`, `lib/password.test.ts`

**Interfaces:**
- Produces:
  - `hashPassword(password: string): Promise<string>` → `"scrypt$<salt base64url>$<hash base64url>"`, 16-byte random salt, 64-byte key, `scrypt` from `node:crypto` (promisified), default cost.
  - `verifyPassword(password: string, stored: string | null): Promise<boolean>` — compares with `timingSafeEqual`; `null` or malformed `stored` still runs one scrypt (against a fixed dummy hash) and returns `false`, so timing doesn't reveal whether the account exists.
  - `UsernameSchema` (zod): trim → lowercase → `^[a-z0-9_]{3,20}$`. `PasswordSchema`: string 8–200 chars.

- [ ] **Step 1: Failing tests:** verify true for the right password, false for a wrong one; two hashes of the same password differ; `verifyPassword("x", null)` → false; malformed `"abc"` → false; `UsernameSchema.parse(" Ab_c ")` → `"ab_c"`; `"ab"`, `"a b"`, `"a".repeat(21)` fail; `PasswordSchema` rejects 7 chars.
- [ ] **Step 2:** Run → FAIL. **Step 3:** Implement. **Step 4:** Run → PASS + full checks.
- [ ] **Step 5:** Commit: `feat: add scrypt password hashing and username rules`.

### Task 5: Rate-limit counter

**Files:**
- Create: `lib/rate-limit.ts`, `lib/rate-limit.test.ts`, `lib/rate-limit.db.test.ts`

**Interfaces:**
- Consumes: `getDb`, `rateLimits` (Task 2).
- Produces:
  - pure `windowStart(nowMs: number, windowMs: number): number` (floor to the window) and `retryAfterSeconds(nowMs: number, windowMs: number): number` (seconds until the window ends, at least 1).
  - `hitRateLimit(bucket: string, limit: number, windowMs: number): Promise<{ allowed: boolean; remaining: number; retryAfterSeconds: number }>` — one atomic upsert: insert `(bucket, windowStart, 1)`, on conflict `count = count + 1`, returning the count; `allowed = count <= limit`; `remaining = max(0, limit − count)`. The pure helpers are exported from the same file; the db function imports `getDb` lazily inside the function or the file starts with `import "server-only"` — either way, `lib/rate-limit.test.ts` must run in plain Vitest.
- `// shortcut: old windows are never deleted; add a daily cleanup if the table grows`.

- [ ] **Step 1: Failing tests.** Unit: `windowStart(125_000, 60_000)` → `120_000`; `retryAfterSeconds(125_000, 60_000)` → `55`; `retryAfterSeconds(179_999, 60_000)` → `1`. DB: with a unique bucket (`test:${randomUUID()}`), limit 3 → hits 1–3 allowed (remaining 2, 1, 0), hit 4 denied; another bucket is independent.
- [ ] **Step 2–4:** Run → FAIL, implement, run → PASS (`npm test` and `npm run test:db`).
- [ ] **Step 5:** Commit: `feat: add a Postgres fixed-window rate limiter`.

### Task 6: Users, lockout and session

**Files:**
- Create: `lib/session-token.ts`, `lib/session-token.test.ts`, `lib/users.ts`, `lib/users.db.test.ts`
- Modify: `lib/session.ts`, `app/auth-actions.ts`, `components/UserMenu.tsx`, `app/favorites/page.tsx`, `app/actions.ts` (only as needed for the new `getCurrentUser` type)

**Interfaces:**
- Consumes: `hashPassword`, `verifyPassword` (Task 4); `getDb`, `users`, `wallets` (Task 2); `STARTING_CASH_CENTS` (Task 3).
- Produces:
  - `type SessionUser = { id: number; username: string }` (in `lib/session-token.ts`).
  - pure `signToken(user: SessionUser, expiresAt: number, secret: string): string` → `"<id>.<username>.<expiresAt>.<signature>"` (HMAC-SHA256, base64url, same as today).
  - pure `verifyToken(token: string | undefined, secret: string, nowMs: number): SessionUser | null` — exactly 4 parts, id a positive integer, username matches `^[a-z0-9_]{3,20}$`, signature checked in constant time (reuse the existing `safeEqual` approach), not expired.
  - `lib/session.ts`: `createSession(user: SessionUser)`, `deleteSession()`, `getCurrentUser(): Promise<SessionUser | null>` (keeps `"use cache: private"` + `cacheLife("minutes")`). `checkCredentials` is **deleted**.
  - `lib/users.ts` (`server-only`): `DEMO_USERNAME = "demo"`; `createUser(username: string, password: string): Promise<{ ok: true; user: SessionUser } | { ok: false; error: "USERNAME_TAKEN" }>` — inserts user + wallet (`STARTING_CASH_CENTS`) in one transaction; Postgres error code `23505` or `username === DEMO_USERNAME` → `USERNAME_TAKEN`. `verifyLogin(username: string, password: string): Promise<SessionUser | null>`. `ensureDemoUser(): Promise<SessionUser>` — idempotent insert of `demo` (null password) and its wallet (`on conflict do nothing`), then select.

`verifyLogin` rules: unknown user → `verifyPassword(password, null)` then `null`. `passwordHash` null (demo) → `null`, no counting. `lockedUntil > now` → run `verifyPassword` anyway, return `null`. Wrong password → `failedLogins = failedLogins + 1` in SQL; when it reaches 5, set `lockedUntil = now + 15 min` and `failedLogins = 0`. Right password → reset `failedLogins` to 0, return the user.

- [ ] **Step 1: Failing tests.** `session-token.test.ts`: sign → verify round trip; tampered username → null; expired → null; old 3-part token `"demo.9999999999999.abc"` → null; `undefined` → null; non-numeric id → null. `users.db.test.ts` (unique usernames per run): `createUser` creates a wallet with `10_000_000` cents; duplicate → `USERNAME_TAKEN`; `"demo"` → `USERNAME_TAKEN`; `verifyLogin` ok; 5 wrong passwords then the right one → `null` (locked); a success after 4 failures resets the counter; `ensureDemoUser()` twice returns the same id.
- [ ] **Step 2–4:** Run → FAIL, implement, run → PASS.
- [ ] **Step 5:** `app/auth-actions.ts` `login` uses `verifyLogin` and `createSession(user)`; remove the brute-force `shortcut:` comment (lockout now exists). `UserMenu` shows `user.username`.
- [ ] **Step 6:** Full checks. Commit: `feat(auth): store users in Postgres with lockout; session carries the user id`.

### Task 7: Sign-up, demo button and auth UI

**Files:**
- Create: `app/signup/page.tsx`, `components/SignupForm.tsx`
- Modify: `app/auth-actions.ts`, `app/login/page.tsx`, `components/LoginForm.tsx` (only if needed), `components/UserMenu.tsx`, `.env.example`

**Interfaces:**
- Consumes: `createUser`, `ensureDemoUser` (Task 6); `UsernameSchema`, `PasswordSchema` (Task 4); `hitRateLimit` (Task 5); `createSession`.
- Produces: Server Actions `signup(prev: SignupState, formData: FormData): Promise<SignupState>` with `type SignupState = { error: string } | null`, and `tryDemo(): Promise<void>`.

- [ ] **Step 1:** `signup`: validate `username`, `password`, `next` with zod; `hitRateLimit("signup:" + ip, 5, 3_600_000)` where `ip` = first comma-separated entry of `x-forwarded-for` from `headers()` (trimmed), or `"unknown"`; denied → `"Too many sign-ups from your network. Try again later."`; `USERNAME_TAKEN` → `"That username is taken."`; success → `createSession`, `redirect(safeNextPath(next))`. Username rule message: `"Usernames are 3–20 letters, numbers or _."`; password: `"Passwords need at least 8 characters."`.
- [ ] **Step 2:** `tryDemo`: `ensureDemoUser()` → `createSession` → `redirect("/")`.
- [ ] **Step 3:** `safeNextPath` default stays `"/"` for now (Task 11 changes it to `/wallet`).
- [ ] **Step 4:** `/signup` page + `SignupForm` (copy `LoginForm`'s structure: `useActionState`, `role="alert"`, pending text "Creating account…"). Link to `/login`.
- [ ] **Step 5:** `/login`: replace the "password is in .env.local" text with a **"Try the demo"** button (a `<form action={tryDemo}>`) and a "Create an account" link to `/signup`. `UserMenu` logged out: "Sign in" and "Sign up" links.
- [ ] **Step 6:** Remove `DEMO_PASSWORD` from `.env.example`.
- [ ] **Step 7:** Full checks; manual check on `npm run dev` (needs `.env.local` with `DATABASE_URL` and `SESSION_SECRET`): sign up, sign out, sign in, 5 wrong passwords → still rejected with the right one, "Try the demo" signs in as demo. Report what was checked.
- [ ] **Step 8:** Commit: `feat(auth): add sign-up, demo button and auth links`.

### Task 8: Bid/ask on quotes and the trade quote

**Files:**
- Create: `lib/trade-quote.ts`, `lib/trade-quote.test.ts`
- Modify: `lib/quotes.ts`

**Interfaces:**
- Consumes: `parseDecimal`, `QTY_SCALE` (Task 3).
- Produces:
  - `Quote` gains `bid: string` and `ask: string` (the API's raw strings); `price` stays `Number(bid)`. The API response type gains `ask`.
  - `type TradeQuote = { bid: bigint; ask: bigint; fetchedAt: number }`
  - pure `toTradeQuote(quote: Quote | undefined, fetchedAt: number, nowMs: number): TradeQuote | null` — `null` if the quote is missing, `nowMs − fetchedAt > 120_000`, or bid/ask don't parse or are `<= 0n`.
  - `getTradeQuote(pair: string): Promise<TradeQuote | null>` in `lib/quotes.ts` — `getQuotes([pair])` inside try/catch (API down → `null`), then `toTradeQuote(quotes[0], fetchedAt, Date.now())`.

- [ ] **Step 1: Failing tests** for `toTradeQuote`: fresh valid quote → bigints (`"5.1234"` → `51234000000n`); 121 s old → null; bid `"0"` → null; ask `"abc"` → null; `undefined` → null.
- [ ] **Step 2–4:** FAIL → implement → PASS; full checks (the home page and cards must render unchanged).
- [ ] **Step 5:** Commit: `feat: expose bid/ask and a freshness-checked trade quote`.

### Task 9: Trade execution in the database

**Files:**
- Create: `lib/trading.ts`, `lib/trading.db.test.ts`

**Interfaces:**
- Consumes: `planTrade`, `PlanOrder`, `TradeErrorCode`, `formatDecimal`, `parseDecimal`, `QTY_SCALE`, `STARTING_CASH_CENTS` (Task 3); `TradeQuote` (Task 8); tables (Task 2); `createUser` (tests).
- Produces (`server-only`):
  - `type Order = { pair: string } & PlanOrder`
  - `type Trade = { id: number; pair: string; side: "buy" | "sell"; quantity: bigint; price: bigint; totalCents: number; createdAt: Date }`
  - `type TradeResult = { ok: true; trade: Trade; replayed: boolean } | { ok: false; code: TradeErrorCode | "IDEMPOTENCY_MISMATCH"; message: string }`
  - `executeTrade(userId: number, order: Order, quote: Pick<TradeQuote, "bid" | "ask">, idempotencyKey: string): Promise<TradeResult>`
  - `getWallet(userId: number): Promise<{ cashCents: number; startedAt: Date; positions: { pair: string; quantity: bigint; costCents: number }[] }>`
  - `listTrades(userId: number, limit = 100): Promise<Trade[]>` — newest first.
  - `resetWallet(userId: number): Promise<void>`

`executeTrade` algorithm, all inside one `db.transaction`:
1. `requestHash` = SHA-256 hex of `JSON.stringify` of `{ pair, side, brlCents }` or `{ pair, side, quantity: <formatDecimal or "all"> }`.
2. Lock the wallet: `select … from wallets where userId = $1 for update` (Drizzle `.for("update")`).
3. Look up a trade with this `(userId, idempotencyKey)`. Found → same hash: return it with `replayed: true`; different hash: `IDEMPOTENCY_MISMATCH` ("This Idempotency-Key was already used for a different order.").
4. Load the position for `pair`, run `planTrade`. Not ok → return the error (nothing written).
5. Write: wallet cash; upsert the position, or delete it when the holding is `null`; insert the trade. Return `{ ok: true, replayed: false }`.

`resetWallet`: in one transaction, lock the wallet, delete the user's trades and positions, set `cashCents = STARTING_CASH_CENTS`, `startedAt = now()`.

- [ ] **Step 1: Failing DB tests** (fresh user per test via `createUser` with a random username):
  - two `executeTrade` buys of R$ 60,000 each at ask `"5"`, run with `Promise.all`, different keys → exactly one ok, cash `4_000_000`.
  - the same key and order twice in a row → second `replayed: true`, one row in `trades`.
  - the same key twice **concurrently** → one trade row.
  - same key, different amount → `IDEMPOTENCY_MISMATCH`.
  - buy then sell `"all"` → position gone, `getWallet` shows cash `< STARTING_CASH_CENTS`.
  - `listTrades` newest first; `resetWallet` → cash back to `10_000_000`, no positions, no trades.
- [ ] **Step 2–4:** FAIL → implement → PASS (`npm run test:db`); full checks.
- [ ] **Step 5:** Commit: `feat: execute trades in row-locked, idempotent transactions`.

### Task 10: Buy/sell form on the currency page

**Files:**
- Create: `app/trade-actions.ts`, `components/TradePanel.tsx`, `components/TradeForm.tsx`
- Modify: `app/currency/[pair]/page.tsx`

**Interfaces:**
- Consumes: `getCurrentUser`; `getTradeQuote` (Task 8); `executeTrade`, `getWallet` (Task 9); `parseBrlToCents`, `parseDecimal`, `formatDecimal`, `QTY_SCALE` (Task 3); `PairSchema` (`lib/favorites.ts`).
- Produces: Server Action `trade(prev: TradeState, formData: FormData): Promise<TradeState>`, `type TradeState = { ok: boolean; message: string } | null`.

- [ ] **Step 1:** `trade` reads `pair`, `side`, `amount`, `all` (`"on"` when "Sell all" is checked), `idempotencyKey` (zod: uuid). Not signed in → `"Sign in to trade."`. Buy amount via `parseBrlToCents`, sell quantity via `parseDecimal(…, QTY_SCALE)` or `"all"`; invalid → `"Enter a valid amount."`. `getTradeQuote` null → `"Price unavailable right now. Try again in a few seconds."`. Error codes → their messages. Success → message like `"Bought 20 USD for R$ 100.00 at R$ 5.00."` (use `formatBRL`, `formatDecimal`), then `refresh()` from `next/cache` (see `node_modules/next/dist/docs/01-app/03-api-reference/04-functions/refresh.md`).
- [ ] **Step 2:** `TradeForm` (client): Buy/Sell toggle, amount input (`inputMode="decimal"`), "Sell all" checkbox in Sell mode, shows cash and held quantity from props, `useActionState(trade, null)`, button disabled while pending, `role="alert"` message. **Idempotency key:** do not render it during SSR. Keep it in a `useRef<string | null>`; wrap the action: `(fd) => { keyRef.current ??= crypto.randomUUID(); fd.set("idempotencyKey", keyRef.current); formAction(fd); }`; set `keyRef.current = null` after a successful result (so the next order gets a new key, and a resend of the same order reuses it).
- [ ] **Step 3:** `TradePanel` (server): `getCurrentUser()`; logged out → `"Sign in to trade"` link to `/login?next=/currency/<PAIR>`; logged in → `getWallet` → `TradeForm` with `cashCents` and the held quantity as a string. Render it in the currency page below the price, in its own `<Suspense>`.
- [ ] **Step 4:** Full checks; manual check on `npm run dev`: buy R$ 100 USD, sell part, sell all, buy over the cash → error, logged out → link. Report what was checked.
- [ ] **Step 5:** Commit: `feat: buy and sell from the currency page`.

### Task 11: Wallet page

**Files:**
- Create: `lib/portfolio.ts`, `lib/portfolio.test.ts`, `app/wallet/page.tsx`, `components/ResetWalletButton.tsx`
- Modify: `app/trade-actions.ts`, `proxy.ts`, `app/layout.tsx`, `app/auth-actions.ts`

**Interfaces:**
- Consumes: `toCents`, `returnPct`, `STARTING_CASH_CENTS` (Task 3); `getWallet`, `listTrades`, `resetWallet` (Task 9); `getQuotes` (with `bid` from Task 8).
- Produces:
  - pure `valuePortfolio(cashCents: number, positions: { pair: string; quantity: bigint; costCents: number }[], bids: Map<string, bigint>): { rows: { pair: string; quantity: bigint; costCents: number; valueCents: number | null; plCents: number | null; plPct: number | null }[]; totalCents: number | null; returnPct: number | null }` — a row's value is `null` when its bid is missing; the total and return are `null` if any row is `null`.
  - Server Action `resetWalletAction(): Promise<void>` (signed-in only; then `refresh()`).

- [ ] **Step 1: Failing tests** for `valuePortfolio`: one position (20 units, cost 10000, bid `"6"`) → value 12000, P/L 2000, 20%; total = cash + 12000; missing bid → row nulls and total null; no positions → total = cash, return from `returnPct`.
- [ ] **Step 2–4:** FAIL → implement → PASS.
- [ ] **Step 5:** `/wallet` page: `getCurrentUser()` → no user: `redirect("/login?next=/wallet")`. Load the wallet, the trades and the quotes for the held pairs (try/catch → empty bids map). Show cards (Total value, Return since <started date>, Cash), a positions table (currency links to `/currency/<pair>`, quantity, average cost = cost ÷ quantity, value, P/L), "Price unavailable" where null, a trade history table (date, currency, Buy/Sell, quantity, price, total) or "No trades yet", and `ResetWalletButton` (two-step: "Reset wallet" → "Reset to R$ 100,000? Yes, reset" / "Cancel").
- [ ] **Step 6:** `proxy.ts`: also redirect `/wallet` and `/settings` without a session cookie (add them to the condition and the `matcher`). Header: add a "Wallet" link. `safeNextPath` default → `"/wallet"`; `tryDemo` redirects to `/wallet`.
- [ ] **Step 7:** Full checks; manual check of the page with and without trades. Commit: `feat: add the wallet page with positions, history and reset`.

### Task 12: Portfolio value chart

**Files:**
- Create: `lib/portfolio-history.ts`, `lib/portfolio-history.test.ts`
- Modify: `app/wallet/page.tsx`

**Interfaces:**
- Consumes: `PricePoint` (`lib/analysis.ts`); `toCents`, `QTY_SCALE` (Task 3); `listTrades` (Task 9); `getHistory`; `PriceChart`.
- Produces: pure `portfolioHistory(input: { startDate: string; startingCashCents: number; trades: { date: string; pair: string; side: "buy" | "sell"; quantity: bigint; totalCents: number }[]; prices: Record<string, PricePoint[]>; today: string }): PricePoint[]` — dates are UTC `YYYY-MM-DD`; trades ascending.

Algorithm: emit one point per calendar day from `max(startDate, today − 365 days)` to `today`. Replay every trade dated on or before each day (trades before the first emitted day still count): buy → cash − total, quantity + q; sell → cash + total, quantity − q. Value = cash + Σ `toCents(quantity, price)`, where `price` = the pair's latest close on or before that day (closes converted with `parseDecimal(String(close), QTY_SCALE)`; if no close exists that early, use the pair's first close). `close` of the point = value ÷ 100 (BRL, a number for the chart).

- [ ] **Step 1: Failing tests** (`startingCashCents: 10_000_000`): start `2026-01-01`, today `2026-01-03`, buy 1 unit of `USD-BRL` (`10_000_000_000n`, total 500 cents) on `2026-01-02`, closes `[{2026-01-01, 5}, {2026-01-03, 6}]` → `[{2026-01-01, 100000}, {2026-01-02, 100000}, {2026-01-03, 100001}]`; no trades → one point of 100000 per day; start = today → exactly one point.
- [ ] **Step 2–4:** FAIL → implement → PASS.
- [ ] **Step 5:** On `/wallet`: `listTrades(userId, 10_000)` reversed, each `createdAt` mapped to `toISOString().slice(0, 10)`, `startDate` from `wallet.startedAt` the same way (`// shortcut: loads every trade; page through them if accounts reach thousands of trades`), `getHistory` for every traded pair (try/catch → hide the chart), `today` from `new Date()` (after the cookie read). Render `PriceChart` when there are ≥ 2 points; otherwise "Your chart appears after your first full day."
- [ ] **Step 6:** Full checks. Commit: `feat: chart the wallet's value over time`.

### Task 13: Leaderboard

**Files:**
- Create: `lib/leaderboard.ts`, `lib/leaderboard.test.ts`, `lib/leaderboard-data.ts`, `app/leaderboard/page.tsx`
- Modify: `app/layout.tsx`

**Interfaces:**
- Consumes: `valuePortfolio` (Task 11); `getDb`, tables; `getQuotes`; `DEMO_USERNAME`.
- Produces:
  - pure `rankWallets(wallets: { username: string; cashCents: number; positions: { pair: string; quantity: bigint; costCents: number }[] }[], bids: Map<string, bigint>): { username: string; totalCents: number; returnPct: number }[] | null` — top 10 by `returnPct` desc, ties by username asc; `null` if any needed bid is missing.
  - `getAllWallets()` (`server-only`, in `lib/leaderboard-data.ts`): every wallet except `DEMO_USERNAME`, with its positions (two queries, grouped in JS). `// shortcut: values every account on each request; cache or precompute when users grow`.

- [ ] **Step 1: Failing tests** for `rankWallets`: ordering, the 10-entry cap, tie by username, a missing bid → `null`.
- [ ] **Step 2–4:** FAIL → implement → PASS.
- [ ] **Step 5:** `/leaderboard` page: `await io()` first; table of rank, username, total, return % (green/red); `null` or a quotes error → "Leaderboard temporarily unavailable."; no users → "No traders yet." Header link "Leaderboard".
- [ ] **Step 6:** Full checks. Commit: `feat: add a public leaderboard`.

---

## Phase 2 — Backtester

### Task 14: Backtest engine (pure)

**Files:**
- Create: `lib/backtest.ts`, `lib/backtest.test.ts`

**Interfaces:**
- Consumes: `PricePoint`.
- Produces:
  - `type Strategy = { kind: "hold" } | { kind: "dip"; dropPct: number; lookbackDays: number; takeProfitPct: number } | { kind: "ma"; shortDays: number; longDays: number }`
  - `type BacktestResult = { equity: PricePoint[]; finalValue: number; returnPct: number; trades: number; maxDrawdownPct: number }`
  - `runBacktest(history: PricePoint[], strategy: Strategy, fromDate: string, startCash = 100_000): BacktestResult`
  - `parseBacktestParams(sp: Record<string, string | string[] | undefined>): { ok: true; pair: string; strategy: Strategy } | { ok: false; error: string }` — zod with `z.coerce.number()`; defaults when a field is absent: `pair` `USD-BRL`, `kind` `dip`, `dropPct` 2, `lookbackDays` 5, `takeProfitPct` 3, `shortDays` 10, `longDays` 30. Ranges: dropPct 0.5–50, lookbackDays 1–60, takeProfitPct 0.5–100, shortDays 2–50, longDays 5–200, `shortDays < longDays`; `pair` must be in `PAIRS`. Arrays (repeated params) → error.

Semantics (floats are fine here: a simulation, never stored): trade only on points with `date >= fromDate`; indicators may read earlier points. All-in/all-out at that day's close. "N days" means N data points back.
- **hold:** buy on the first tradable point. 1 trade.
- **dip:** flat and `i − lookbackDays >= 0` and `close[i] <= close[i − lookbackDays] × (1 − dropPct/100)` → buy, remember the entry. Holding and `close[i] >= entry × (1 + takeProfitPct/100)` → sell.
- **ma:** needs `i >= longDays − 1`; SMA over the last S / L points including `i`. Flat and `smaS > smaL` → buy; holding and `smaS < smaL` → sell.
- `equity[i]` = cash + units × close for each tradable point. `trades` counts buys and sells. `maxDrawdownPct` = max of `(peak − equity) / peak × 100` over the run.

- [ ] **Step 1: Failing tests** (dates `2026-01-01`… one per point, `fromDate` = the first date; compare with `toBeCloseTo(…, 2)`):
  - closes `[10, 9, 8, 9, 12]`, **hold** → final 120000, return 20, trades 1, maxDD 20.
  - same closes, **dip** (10%, 1 day, 20%) → buys at 9, sells at 12: final 133333.33, return 33.33, trades 2, maxDD 11.11.
  - closes `[1, 2, 3, 2, 1, 2, 3]`, **ma** (2, 3) → buy at 3 (i=2), sell at 1 (i=4), buy at 3 (i=6): final 33333.33, return −66.67, trades 3.
  - `fromDate` after the first points: no trades before it, but the dip lookback reads earlier closes.
  - `parseBacktestParams({})` → defaults; `shortDays` ≥ `longDays` → error; `pair: "XXX-BRL"` → error; `dropPct: "abc"` → error.
- [ ] **Step 2–4:** FAIL → implement → PASS; full checks.
- [ ] **Step 5:** Commit: `feat: add a backtest engine with three strategies`.

### Task 15: Backtest page

**Files:**
- Create: `app/backtest/page.tsx`
- Modify: `lib/chart.ts`, `lib/chart.test.ts`, `components/PriceChart.tsx`, `app/layout.tsx`

**Interfaces:**
- Consumes: `runBacktest`, `parseBacktestParams` (Task 14); `getHistory`; `sliceRange` (`"1Y"` → the first date of the slice is `fromDate`); `CATALOG`.
- Produces: `buildLinePath(values, width, height, domain?: [min: number, max: number])` — when given, scales against `domain` instead of the values' own min/max (existing calls unchanged). `PriceChart` gains optional `compare?: PricePoint[]` drawn as a dashed gray line on a shared domain, with a tiny legend ("Strategy", "Buy and hold").

- [ ] **Step 1: Failing test** in `lib/chart.test.ts`: `buildLinePath([1, 2], 100, 100, [0, 4])` → `"M0,75 L100,50"`. Existing chart tests unchanged.
- [ ] **Step 2–4:** FAIL → implement → PASS.
- [ ] **Step 5:** `/backtest` (public): a plain `<form method="get">` (works without JavaScript) with currency `<select>` (all of `CATALOG`), strategy `<select>`, and all parameter inputs grouped under headings per strategy; defaults pre-filled from `parseBacktestParams`. Results in a `<Suspense>` child that awaits `searchParams`: invalid → the error message; else `getHistory(pair)` (error → "History unavailable"), the chosen strategy and buy-and-hold over the last year, stat cards (final value, return %, trades, max drawdown — strategy vs buy-and-hold), and the chart with `compare`. A note: "Simulated on daily closing prices, no spread or fees." Header link "Backtest".
- [ ] **Step 6:** Full checks; manual check of each strategy and an invalid URL. Commit: `feat: add the backtest page`.

---

## Phase 3 — Bot trading API

### Task 16: API keys (data layer)

**Files:**
- Create: `lib/api-keys.ts`, `lib/api-keys.test.ts`, `lib/api-keys.db.test.ts`, new migration in `drizzle/`
- Modify: `lib/db/schema.ts`

**Interfaces:**
- Consumes: `getDb`; `DEMO_USERNAME`; `createUser` (tests).
- Produces:
  - table `apiKeys`: `id` serial PK; `userId` → `users.id` not null; `name` text not null; `prefix` text not null; `keyHash` text not null unique; `createdAt` timestamptz default now; `lastUsedAt` timestamptz nullable; `revokedAt` timestamptz nullable.
  - pure `generateApiKey(): { key: string; prefix: string; hash: string }` — `key = "ptk_" + randomBytes(32).toString("base64url")`, `prefix = key.slice(0, 12)`, `hash = hashApiKey(key)`; `hashApiKey(key: string): string` — SHA-256 hex; `parseBearer(header: string | null): string | null` — `"Bearer <key>"` → key, anything else → null.
  - `server-only` functions (export from the same file only if the pure tests still run in plain Vitest; otherwise put them in `lib/api-keys-data.ts`): `createApiKey(user: { id: number; username: string }, name: string): Promise<{ ok: true; key: string } | { ok: false; code: "LIMIT_REACHED" | "DEMO_NOT_ALLOWED" }>`; `listApiKeys(userId: number): Promise<{ id: number; name: string; prefix: string; createdAt: Date; lastUsedAt: Date | null }[]>` (active only); `revokeApiKey(userId: number, id: number): Promise<void>` (only the user's own key); `authenticateApiKey(authorization: string | null): Promise<{ userId: number; keyId: number } | null>` — not revoked; updates `lastUsedAt`.
  - `// shortcut: two simultaneous creates can exceed 3 keys; lock the user row if it matters`.

- [ ] **Step 1:** Add the table; `npm run db:generate`; commit the new migration file.
- [ ] **Step 2: Failing tests.** Unit: key starts with `ptk_` and has 47 chars; `prefix` is its first 12 chars; `hash` is 64 hex chars and equals `hashApiKey(key)`; `parseBearer("Bearer abc")` → `"abc"`, `"bearer abc"` → `"abc"` (case-insensitive scheme), `"Basic abc"`, `null`, `"Bearer "` → null. DB: 3 keys ok, 4th `LIMIT_REACHED`, revoke one → a new one ok; demo → `DEMO_NOT_ALLOWED`; `authenticateApiKey("Bearer " + key)` → ids; revoked → null; garbage → null; revoking another user's key does nothing.
- [ ] **Step 3–4:** Implement → PASS (`npm test`, `npm run test:db`); full checks.
- [ ] **Step 5:** Commit: `feat(api): add hashed, revocable API keys`.

### Task 17: API keys page

**Files:**
- Create: `app/settings/api-keys/page.tsx`, `app/api-key-actions.ts`, `components/NewApiKeyForm.tsx`

**Interfaces:**
- Consumes: Task 16 functions; `getCurrentUser`.
- Produces: Server Actions `createKeyAction(prev: CreateKeyState, formData: FormData): Promise<CreateKeyState>` with `type CreateKeyState = { key?: string; error?: string } | null`, and `revokeKeyAction(formData: FormData): Promise<void>` (reads `id`, zod positive int, then `refresh()`).

- [ ] **Step 1:** Page: no user → `redirect("/login?next=/settings/api-keys")`. Table of active keys (name, `prefix…`, created, last used or "Never", Revoke button). Demo → a note "The shared demo account can't create API keys — create your own account." instead of the form. Link to `/docs/api`.
- [ ] **Step 2:** `NewApiKeyForm` (client): name input (1–50 chars); on success shows the full key once in a `<code>` box with a Copy button (`navigator.clipboard.writeText`) and "Copy it now — you won't see it again."; errors: `LIMIT_REACHED` → "You can have up to 3 keys. Revoke one first."
- [ ] **Step 3:** `UserMenu` (signed in): add an "API keys" link.
- [ ] **Step 4:** Full checks; manual: create, copy, revoke, 4th key error, demo note. Commit: `feat(api): add the API keys page`.

### Task 18: API v1 plumbing and read endpoints

**Files:**
- Create: `lib/api.ts`, `lib/api.test.ts`, `app/api/v1/quotes/route.ts`, `app/api/v1/history/[pair]/route.ts`, `app/api/v1/wallet/route.ts`

**Interfaces:**
- Consumes: `authenticateApiKey` (Task 16); `hitRateLimit` (Task 5); `getQuotes`, `getHistory`, `sliceRange`; `getWallet` (Task 9); `valuePortfolio` (Task 11); `centsToBrl`, `formatDecimal`, `parseDecimal`, `QTY_SCALE` (Task 3); `findCurrency`.
- Produces:
  - pure `apiError(status: number, code: string, message: string, headers?: HeadersInit): Response` → JSON `{ error: { code, message } }`.
  - `withApiKey<Ctx>(handler: (request: Request, ctx: Ctx, auth: { userId: number; keyId: number }) => Promise<Response>): (request: Request, ctx: Ctx) => Promise<Response>` — missing/invalid key → `401 UNAUTHORIZED`; `hitRateLimit("api:" + keyId, 60, 60_000)` denied → `429 RATE_LIMITED` with `Retry-After`; otherwise runs the handler and sets `X-RateLimit-Remaining` on its response (also on the 429).
  - `GET /api/v1/quotes` → `{ data: [{ pair, currency, bid, ask, updatedAt }], fetchedAt }` (ISO string); API down → `503 PRICE_UNAVAILABLE`.
  - `GET /api/v1/history/{pair}` → `{ data: [{ date, close }] }` for the last year (`sliceRange(…, "1Y")`); unknown pair (case-insensitive via `findCurrency`) → `404 UNKNOWN_PAIR`.
  - `GET /api/v1/wallet` → `{ data: { cash, startedAt, positions: [{ pair, quantity, averageCost, value }], total, returnPct } }` — BRL amounts as strings via `centsToBrl`, quantities via `formatDecimal`, `averageCost` = cost ÷ quantity as a BRL string with 2 decimals (display only), `value`/`total`/`returnPct` `null` when quotes are unavailable.

- [ ] **Step 1: Failing tests** (`lib/api.test.ts`): `apiError(404, "UNKNOWN_PAIR", "…")` → status 404, body shape, content-type JSON, extra headers kept.
- [ ] **Step 2–4:** FAIL → implement → PASS.
- [ ] **Step 5:** Routes use the `RouteContext<"/api/v1/history/[pair]">` pattern from `app/api/favorites/[pair]/route.ts`. Read the Route Handler guide in `node_modules/next/dist/docs/` first.
- [ ] **Step 6:** Full checks; manual with `curl` on `npm run dev` using a key from Task 17: each endpoint 200; no key → 401; bad pair → 404. Report the commands and responses.
- [ ] **Step 7:** Commit: `feat(api): add v1 auth, rate limit and read endpoints`.

### Task 19: Orders endpoints

**Files:**
- Create: `app/api/v1/orders/route.ts`, `lib/api-orders.ts`, `lib/api-orders.test.ts`

**Interfaces:**
- Consumes: `withApiKey`, `apiError` (Task 18); `executeTrade`, `listTrades`, `Trade` (Task 9); `getTradeQuote` (Task 8); `parseBrlToCents`, `parseDecimal`, `formatDecimal`, `centsToBrl`, `QTY_SCALE` (Task 3); `findCurrency`.
- Produces:
  - pure `OrderBodySchema` (zod discriminated union on `side`): `{ pair: string; side: "buy"; brl: string }` | `{ pair: string; side: "sell"; quantity: string }` (`quantity` may be `"all"`).
  - pure `tradeToJson(trade: Trade): { id; pair; side; quantity: string; price: string; total: string; createdAt: string }`.
  - `POST /api/v1/orders`: `Idempotency-Key` header required, 1–100 chars → else `400 IDEMPOTENCY_KEY_REQUIRED`; invalid JSON or body → `400 INVALID_BODY`; unknown pair → `404 UNKNOWN_PAIR`; invalid amount → `400 INVALID_AMOUNT`; no quote → `503 PRICE_UNAVAILABLE`; trade error codes and `IDEMPOTENCY_MISMATCH` → `422` with that code; success → `201` `{ data: trade }`, replay → `200` with the same body.
  - `GET /api/v1/orders?limit=` → 1–100, default 50, invalid → `400 INVALID_LIMIT`; `{ data: trade[] }` newest first.

- [ ] **Step 1: Failing tests:** `OrderBodySchema` accepts both shapes and `"all"`, rejects `side: "short"`, a numeric `brl` (must be a string), missing fields; `tradeToJson` formats `quantity: 200000000000n` → `"20"`, `totalCents: 10000` → `"100.00"`, `createdAt` ISO.
- [ ] **Step 2–4:** FAIL → implement → PASS.
- [ ] **Step 5:** Full checks; manual `curl` on `npm run dev`: buy (201), the same request again (200, same id), same key with another amount (422), no key header (400), sell `"all"` (201), GET list. Report the commands and responses.
- [ ] **Step 6:** Commit: `feat(api): add idempotent order endpoints`.

### Task 20: API docs page and example bot

**Files:**
- Create: `app/docs/api/page.tsx`, `examples/bot.py`
- Modify: `app/layout.tsx`

**Interfaces:**
- Consumes: the endpoint contracts from Tasks 18–19 (copy them exactly).

- [ ] **Step 1:** `/docs/api` (static, public): getting a key (link to `/settings/api-keys`), `Authorization: Bearer`, the 60/min limit and its headers, `Idempotency-Key`, the error format and every code, and each endpoint with a `curl` example and a sample response. Base URL `https://next-js-training-ten-gamma.vercel.app`. Header link "API".
- [ ] **Step 2:** `examples/bot.py` — Python 3 **standard library only** (`urllib.request`, `json`, `os`, `uuid`), about 50 lines, a top docstring with how to run it (`API_KEY=... python examples/bot.py`; optional `BASE_URL`, `PAIR` default `USD-BRL`). Logic: fetch history, 5-day vs 20-day moving average of closes; fetch the wallet; short > long and no position → buy `"1000.00"`; short < long and holding → sell `"all"`; otherwise print "Holding steady". Every order sends a fresh `uuid4` as `Idempotency-Key`. Prints the API's error message on HTTP errors.
- [ ] **Step 3:** Full checks; `python -c "import ast; ast.parse(open('examples/bot.py').read())"` passes; if a dev server and key are available, run it once and report the output.
- [ ] **Step 4:** Commit: `docs(api): add the API docs page and a Python example bot`.

---

## Day 7

### Task 21: README for recruiters

**Files:**
- Modify: `README.md`

- [ ] **Step 1:** Rewrite `README.md`: one-paragraph pitch; live link and the "Try the demo" button; features per phase; a short "How it works" (architecture, the money rules, idempotency, row locks, rate limits, API keys hashed); API quick start (curl + `examples/bot.py`); local setup (`.env.example`, `db:migrate`, `dev`, `test`, `test:db`); CI/CD (PR checks, preview deploys, production on merge). No claims the code doesn't back.
- [ ] **Step 2:** Commit: `docs: rewrite the README for the paper trading release`.
