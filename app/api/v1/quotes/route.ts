import { apiError, withApiKey } from "@/lib/api";
import { PAIRS } from "@/lib/currencies";
import { getQuotes } from "@/lib/quotes";

// GET /api/v1/quotes → every catalog pair, with the raw bid and ask strings
export const GET = withApiKey(async () => {
  try {
    const { quotes, fetchedAt } = await getQuotes(PAIRS);
    return Response.json({
      data: quotes.map(({ pair, currency, bid, ask, updatedAt }) => ({
        pair,
        currency,
        bid,
        ask,
        updatedAt,
      })),
      fetchedAt: new Date(fetchedAt).toISOString(),
    });
  } catch (error) {
    console.error(error); // details stay in the server logs
    return apiError(503, "PRICE_UNAVAILABLE", "Prices are unavailable right now.");
  }
});
