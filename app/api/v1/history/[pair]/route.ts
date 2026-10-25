import { apiError, withApiKey } from "@/lib/api";
import { findCurrency } from "@/lib/currencies";
import { sliceRange } from "@/lib/analysis";
import { getHistory } from "@/lib/history";

// GET /api/v1/history/USD-BRL → daily closes for the last year
export const GET = withApiKey(async (_request, ctx: RouteContext<"/api/v1/history/[pair]">) => {
  const { pair } = await ctx.params;
  const currency = findCurrency(pair); // checked before any upstream call
  if (!currency) return apiError(404, "UNKNOWN_PAIR", `Unknown pair: ${pair}`);

  try {
    return Response.json({ data: sliceRange(await getHistory(currency.pair), "1Y") });
  } catch (error) {
    console.error(error);
    return apiError(503, "PRICE_UNAVAILABLE", "Prices are unavailable right now.");
  }
});
