import { apiError, withApiKey } from "@/lib/api";
import { LimitSchema, OrderBodySchema, tradeToJson } from "@/lib/api-orders";
import { findCurrency } from "@/lib/currencies";
import { parseBrlToCents, parseDecimal, QTY_SCALE } from "@/lib/money";
import { getTradeQuote } from "@/lib/quotes";
import { executeTrade, listTrades, type Order } from "@/lib/trading";

// POST /api/v1/orders → buy or sell at the live quote; the Idempotency-Key makes retries safe
export const POST = withApiKey(async (request, _ctx, auth) => {
  const key = request.headers.get("idempotency-key");
  if (key === null || key.length < 1 || key.length > 100) {
    return apiError(
      400,
      "IDEMPOTENCY_KEY_REQUIRED",
      "Send an Idempotency-Key header (1–100 characters).",
    );
  }

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return apiError(400, "INVALID_BODY", "The body must be valid JSON.");
  }
  const parsed = OrderBodySchema.safeParse(json);
  if (!parsed.success) {
    return apiError(400, "INVALID_BODY", "Send pair, side and brl (buy) or quantity (sell).");
  }
  const body = parsed.data;

  // The canonical pair makes "usd-brl" and "USD-BRL" the same order for idempotency
  const currency = findCurrency(body.pair);
  if (!currency) return apiError(404, "UNKNOWN_PAIR", `Unknown pair: ${body.pair}`);

  let order: Order;
  if (body.side === "buy") {
    const brlCents = parseBrlToCents(body.brl);
    if (brlCents === null) {
      return apiError(400, "INVALID_AMOUNT", "brl must be an amount like 100 or 100.50.");
    }
    order = { pair: currency.pair, side: "buy", brlCents };
  } else if (body.quantity === "all") {
    order = { pair: currency.pair, side: "sell", quantity: "all" };
  } else {
    const quantity = parseDecimal(body.quantity, QTY_SCALE);
    if (quantity === null) {
      return apiError(400, "INVALID_AMOUNT", "quantity must be a number or \"all\".");
    }
    order = { pair: currency.pair, side: "sell", quantity };
  }

  const quote = await getTradeQuote(currency.pair);
  if (!quote) return apiError(503, "PRICE_UNAVAILABLE", "Prices are unavailable right now.");

  const result = await executeTrade(auth.userId, order, quote, key);
  if (!result.ok) return apiError(422, result.code, result.message);

  // A replay returns the stored trade with 200, so the client can tell it apart from a new trade
  return Response.json(
    { data: tradeToJson(result.trade) },
    { status: result.replayed ? 200 : 201 },
  );
});

// GET /api/v1/orders?limit=50 → the caller's trades, newest first
export const GET = withApiKey(async (request, _ctx, auth) => {
  const raw = new URL(request.url).searchParams.get("limit");
  let limit = 50;
  if (raw !== null) {
    const parsed = LimitSchema.safeParse(raw);
    if (!parsed.success) {
      return apiError(400, "INVALID_LIMIT", "limit must be an integer from 1 to 100.");
    }
    limit = parsed.data;
  }

  const trades = await listTrades(auth.userId, limit);
  return Response.json({ data: trades.map(tradeToJson) });
});
