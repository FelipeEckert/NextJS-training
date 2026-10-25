import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";

export const metadata: Metadata = { title: "API docs" };

const BASE_URL = "https://next-js-training-ten-gamma.vercel.app";

const ERRORS = [
  { status: 400, code: "IDEMPOTENCY_KEY_REQUIRED", message: "Send an Idempotency-Key header (1–100 characters)." },
  { status: 400, code: "INVALID_BODY", message: "The body must be valid JSON. / Send pair, side and brl (buy) or quantity (sell)." },
  { status: 400, code: "INVALID_AMOUNT", message: "brl must be an amount like 100 or 100.50. / quantity must be a number or \"all\"." },
  { status: 400, code: "INVALID_LIMIT", message: "limit must be an integer from 1 to 100." },
  { status: 401, code: "UNAUTHORIZED", message: "Missing or invalid API key." },
  { status: 404, code: "UNKNOWN_PAIR", message: "Unknown pair: {pair}" },
  { status: 422, code: "BELOW_MINIMUM", message: "The minimum order is R$ 1.00." },
  { status: 422, code: "INSUFFICIENT_CASH", message: "You do not have enough cash for this order." },
  { status: 422, code: "NO_POSITION", message: "You do not hold this currency." },
  { status: 422, code: "INSUFFICIENT_QUANTITY", message: "You do not hold that much." },
  { status: 422, code: "AMOUNT_TOO_SMALL", message: "The amount is too small to trade." },
  { status: 422, code: "IDEMPOTENCY_MISMATCH", message: "This Idempotency-Key was already used for a different order." },
  { status: 429, code: "RATE_LIMITED", message: "Too many requests. Try again later." },
  { status: 500, code: "INTERNAL_ERROR", message: "Something went wrong." },
  { status: 503, code: "PRICE_UNAVAILABLE", message: "Prices are unavailable right now." },
];

export default function ApiDocsPage() {
  return (
    <main className="mx-auto w-full max-w-5xl p-8">
      <h1 className="text-3xl font-bold">API</h1>
      <p className="mt-2 text-zinc-500">
        Let your own bot trade on your paper account. Every endpoint is JSON over HTTPS.
      </p>
      <p className="mt-4">Base URL</p>
      <Code>{BASE_URL}</Code>

      <Section title="Getting a key">
        <p className="mt-3">
          Create a key on the{" "}
          <Link href="/settings/api-keys" className="font-medium underline">
            API keys
          </Link>{" "}
          page. You can have up to 3 active keys. The shared demo account can&apos;t create keys;
          sign up for your own account first.
        </p>
      </Section>

      <Section title="Authentication">
        <p className="mt-3">
          Send the key in the <code>Authorization</code> header. A missing or invalid key gets{" "}
          <code>401 UNAUTHORIZED</code> with <code>WWW-Authenticate: Bearer</code>.
        </p>
        <Code>{`curl -H "Authorization: Bearer $API_KEY" ${BASE_URL}/api/v1/wallet`}</Code>
      </Section>

      <Section title="Rate limits">
        <p className="mt-3">
          Each key may make 60 requests per minute. The limit counts fixed one-minute windows.
          Requests that pass authentication include <code>X-RateLimit-Remaining</code>, the
          requests left in the current window. Past the limit you get{" "}
          <code>429 RATE_LIMITED</code> with a <code>Retry-After</code> header, in seconds.
        </p>
        <Code>{`HTTP/2 200
X-RateLimit-Remaining: 59
Cache-Control: no-store`}</Code>
      </Section>

      <Section title="Errors">
        <p className="mt-3">
          Every error has the same shape: an <code>error</code> object with a{" "}
          <code>code</code> to branch on and a <code>message</code> for people.
        </p>
        <Code>{`{"error":{"code":"INSUFFICIENT_CASH","message":"You do not have enough cash for this order."}}`}</Code>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-zinc-200 dark:border-zinc-800">
              <tr>
                <th className="py-2 pr-4 font-semibold">Status</th>
                <th className="py-2 pr-4 font-semibold">Code</th>
                <th className="py-2 font-semibold">Message</th>
              </tr>
            </thead>
            <tbody>
              {ERRORS.map((error) => (
                <tr key={error.code} className="border-b border-zinc-100 dark:border-zinc-900">
                  <td className="py-2 pr-4 tabular-nums">{error.status}</td>
                  <td className="py-2 pr-4 font-mono">{error.code}</td>
                  <td className="py-2">{error.message}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      <Section title="Conventions">
        <ul className="mt-3 list-disc space-y-2 pl-6">
          <li>
            Amounts are strings. A <code>brl</code> amount with more than 2 decimals is rejected
            with <code>400 INVALID_AMOUNT</code>. A <code>quantity</code> with more than 10
            decimals is accepted, but the extra decimals are dropped, never rounded up.
          </li>
          <li>Pairs are case-insensitive: <code>usd-brl</code> and <code>USD-BRL</code> are the same.</li>
          <li>Buys fill at the ask and sells at the bid. Rounding always goes down.</li>
          <li>
            Quotes refresh at most once a minute. An order needs a quote no older than 120 seconds,
            otherwise you get <code>503 PRICE_UNAVAILABLE</code>.
          </li>
        </ul>
      </Section>

      <Section title="Idempotency and retries">
        <p className="mt-3">
          <code>POST /api/v1/orders</code> requires an <code>Idempotency-Key</code> header of 1 to
          100 characters. Use a fresh key, such as a UUID, for each new order.
        </p>
        <ul className="mt-3 list-disc space-y-2 pl-6">
          <li>
            Sending the same key with the same order again returns the stored trade with{" "}
            <code>200</code> instead of <code>201</code>. No second trade is made.
          </li>
          <li>
            Sending the same key with a different order returns{" "}
            <code>422 IDEMPOTENCY_MISMATCH</code>.
          </li>
          <li>
            A <code>503 PRICE_UNAVAILABLE</code> is sent before the idempotency lookup, so that
            request never trades. A retry needs a fresh quote too, so during a price outage even a
            retry of an order that already went through gets <code>503</code>. Retry later with the{" "}
            <strong>same</strong> Idempotency-Key: once prices are back, an order that already went
            through returns the stored trade with <code>200</code>.
          </li>
          <li>
            Resetting your wallet deletes your trades, so the old Idempotency-Keys become usable
            again.
          </li>
        </ul>
      </Section>

      <Section title="Endpoints">
        <Endpoint
          title="GET /api/v1/quotes"
          description="Every catalog pair with its bid and ask, plus when the prices were fetched. Buys fill at the ask and sells at the bid."
          request={`curl -H "Authorization: Bearer $API_KEY" ${BASE_URL}/api/v1/quotes`}
          response={`{
  "data": [
    {
      "pair": "USD-BRL",
      "currency": "US Dollar (USD)",
      "bid": "4.9652",
      "ask": "4.966",
      "updatedAt": "2026-10-23T21:30:08.000Z"
    }
  ],
  "fetchedAt": "2026-10-25T13:31:02.115Z"
}`}
          note="Shortened to one pair; the real list has every catalog pair."
        />

        <Endpoint
          title="GET /api/v1/history/{pair}"
          description="Daily closes for the last year, oldest first. An unknown pair returns 404 UNKNOWN_PAIR."
          request={`curl -H "Authorization: Bearer $API_KEY" ${BASE_URL}/api/v1/history/USD-BRL`}
          response={`{
  "data": [
    { "date": "2025-10-24", "close": 5.3884 },
    { "date": "2025-10-26", "close": 5.3883 }
  ]
}`}
          note="Shortened to two closes; the real array holds about a year of daily closes."
        />

        <Endpoint
          title="GET /api/v1/wallet"
          description="Your cash, positions and total value. returnPct is the percent return since you started. Each position's value is null when that pair has no price right now. total and returnPct are null when any held pair has no price."
          request={`curl -H "Authorization: Bearer $API_KEY" ${BASE_URL}/api/v1/wallet`}
          response={`{
  "data": {
    "cash": "99000.00",
    "startedAt": "2026-10-14T23:43:06.890Z",
    "positions": [
      {
        "pair": "USD-BRL",
        "quantity": "201.3693113169",
        "averageCost": "4.96",
        "value": "999.83"
      }
    ],
    "total": "99999.83",
    "returnPct": -0.00017
  }
}`}
          note="Shortened to one position."
        />

        <Endpoint
          title="POST /api/v1/orders"
          description={`Buy with brl, or sell with quantity. Send "all" (lowercase only; "ALL" gets 400 INVALID_AMOUNT) as the quantity to sell the whole position. Unknown fields, or a field for the other side such as brl on a sell, get 400 INVALID_BODY. Returns 201 with the new trade, or 200 when the Idempotency-Key was already used for this order. A buy needs at least R$ 1.00.`}
          request={`curl -X POST ${BASE_URL}/api/v1/orders \\
  -H "Authorization: Bearer $API_KEY" \\
  -H "Idempotency-Key: 3f9c1e7a-5b2d-4e8f-9a61-0c4d7b2e8f15" \\
  -H "Content-Type: application/json" \\
  -d '{"pair":"EUR-BRL","side":"buy","brl":"100.00"}'`}
          response={`{
  "data": {
    "id": 62,
    "pair": "EUR-BRL",
    "side": "buy",
    "quantity": "17.9736506281",
    "price": "5.5637",
    "total": "100.00",
    "createdAt": "2026-10-25T22:47:28.003Z"
  }
}`}
          extra={
            <>
              <p className="mt-3">A sell body looks like this:</p>
              <Code>{`{"pair":"EUR-BRL","side":"sell","quantity":"all"}`}</Code>
              <p className="mt-3">
                Errors from a trade, such as <code>INSUFFICIENT_CASH</code>, come back as{" "}
                <code>422</code>.
              </p>
            </>
          }
        />

        <Endpoint
          title="GET /api/v1/orders?limit=50"
          description="Your trades, newest first. limit is optional: an integer from 1 to 100, default 50."
          request={`curl -H "Authorization: Bearer $API_KEY" "${BASE_URL}/api/v1/orders?limit=2"`}
          response={`{
  "data": [
    {
      "id": 62,
      "pair": "EUR-BRL",
      "side": "buy",
      "quantity": "17.9736506281",
      "price": "5.5637",
      "total": "100.00",
      "createdAt": "2026-10-25T22:47:28.003Z"
    }
  ]
}`}
          note="Shortened to one trade."
        />
      </Section>

      <Section title="Example bot">
        <p className="mt-3">
          <code>examples/bot.py</code> in the repository is a short moving-average bot. It uses only
          the Python standard library:
        </p>
        <Code>{`API_KEY=... python examples/bot.py`}</Code>
      </Section>
    </main>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mt-10">
      <h2 className="text-xl font-semibold">{title}</h2>
      {children}
    </section>
  );
}

function Endpoint({
  title,
  description,
  request,
  response,
  note,
  extra,
}: {
  title: string;
  description: string;
  request: string;
  response: string;
  note?: string;
  extra?: ReactNode;
}) {
  return (
    <div className="mt-6 rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
      <h3 className="font-mono text-base font-semibold">{title}</h3>
      <p className="mt-2">{description}</p>
      {extra}
      <p className="mt-3 text-sm font-medium text-zinc-500">Request</p>
      <Code>{request}</Code>
      <p className="mt-3 text-sm font-medium text-zinc-500">Response</p>
      <Code>{response}</Code>
      {note && <p className="mt-2 text-sm text-zinc-500">{note}</p>}
    </div>
  );
}

function Code({ children }: { children: string }) {
  return (
    <pre className="mt-2 overflow-x-auto rounded-xl bg-zinc-100 p-4 text-sm dark:bg-zinc-900">
      <code>{children}</code>
    </pre>
  );
}
