// The house bot's strategy and daily run. Pure: the caller passes fetch, so tests need no network.
// It trades through the public /api/v1 like any user's bot, so every rule the API enforces applies to it.

export const HOUSE_BOT_USERNAME = "house_bot";
export const HOUSE_BOT_PAIRS = ["USD-BRL", "EUR-BRL", "GBP-BRL", "BTC-BRL"];
export const HOUSE_BOT_BUY_BRL = "10000.00";

export type HouseBotResult = {
  pair: string;
  action: "buy" | "sell" | "hold" | "error";
  detail: string;
};

type Trade = { side: string; quantity: string; price: string; total: string };
type Outcome<T> = { ok: true; status: number; data: T } | { ok: false; detail: string };

// Same rule as examples/bot.py: 5-day vs 20-day mean of closes, oldest first
export function decide(closes: number[], holding: boolean): "buy" | "sell" | "hold" {
  if (closes.length < 20) return "hold";
  const mean = (values: number[]) => values.reduce((sum, value) => sum + value, 0) / values.length;
  const short = mean(closes.slice(-5));
  const long = mean(closes.slice(-20));
  if (short > long && !holding) return "buy";
  if (short < long && holding) return "sell";
  return "hold";
}

// One order per pair per UTC day, so a cron retry replays the same order instead of trading twice.
// shortcut: a buy and a sell of the same pair on the same UTC day share a key, so the second gets 422 IDEMPOTENCY_MISMATCH (only if the signal flips within a day); add the side to the key if that ever matters
export function idempotencyKey(pair: string, now: Date): string {
  return `house-bot-${now.toISOString().slice(0, 10)}-${pair}`;
}

// One request, reduced to data or to the detail line. Network errors become details too.
async function call<T>(send: typeof fetch, url: string, init: RequestInit): Promise<Outcome<T>> {
  let res: Response;
  try {
    res = await send(url, { ...init, signal: AbortSignal.timeout(10_000), redirect: "manual" });
  } catch (error) {
    return { ok: false, detail: error instanceof Error ? error.message : String(error) };
  }
  const body: { data?: T; error?: { code: string; message: string } } | null = await res
    .json()
    .catch(() => null);
  if (res.ok) {
    if (body?.data === undefined) return { ok: false, detail: `${res.status} not an API response` };
    return { ok: true, status: res.status, data: body.data };
  }
  if (body?.error) {
    return { ok: false, detail: `${res.status} ${body.error.code}: ${body.error.message}` };
  }
  if (res.status >= 300 && res.status < 400) {
    return { ok: false, detail: `${res.status} redirected to ${res.headers.get("location") ?? "?"}` };
  }
  return { ok: false, detail: String(res.status) };
}

export async function runHouseBot(opts: {
  baseUrl: string;
  apiKey: string;
  now: Date;
  fetch: typeof fetch;
}): Promise<HouseBotResult[]> {
  const { baseUrl, apiKey, now, fetch: send } = opts;
  const headers = { Authorization: `Bearer ${apiKey}` };

  const wallet = await call<{ positions: { pair: string }[] }>(send, `${baseUrl}/api/v1/wallet`, {
    headers,
  });
  // Don't trade blind: without the wallet, no pair can be checked for a position
  if (!wallet.ok) {
    return HOUSE_BOT_PAIRS.map((pair) => ({ pair, action: "error", detail: wallet.detail }));
  }

  const results: HouseBotResult[] = [];
  for (const pair of HOUSE_BOT_PAIRS) {
    const history = await call<{ close: number }[]>(send, `${baseUrl}/api/v1/history/${pair}`, {
      headers,
    });
    if (!history.ok) {
      results.push({ pair, action: "error", detail: history.detail });
      continue;
    }

    const holding = wallet.data.positions.some((position) => position.pair === pair);
    const action = decide(history.data.map((point) => point.close), holding);
    if (action === "hold") {
      results.push({ pair, action, detail: "no signal" });
      continue;
    }

    const body =
      action === "buy"
        ? { pair, side: "buy", brl: HOUSE_BOT_BUY_BRL }
        : { pair, side: "sell", quantity: "all" };
    const order = await call<Trade>(send, `${baseUrl}/api/v1/orders`, {
      method: "POST",
      headers: {
        ...headers,
        "Content-Type": "application/json",
        "Idempotency-Key": idempotencyKey(pair, now),
      },
      body: JSON.stringify(body),
    });
    if (!order.ok) {
      results.push({ pair, action: "error", detail: order.detail });
      continue;
    }

    // A 200 means today's order already went through on an earlier run
    const replay = order.status === 200 ? "already done today: " : "";
    const trade = order.data;
    results.push({
      pair,
      action,
      detail: `${replay}${trade.side} ${trade.quantity} at ${trade.price}, total ${trade.total}`,
    });
  }
  return results;
}
