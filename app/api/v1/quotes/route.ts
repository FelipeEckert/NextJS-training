import { apiError, withApiKey } from "@/lib/api";
import { PAIRS } from "@/lib/currencies";
import { getQuotes } from "@/lib/quotes";

// GET /api/v1/quotes → every catalog pair, with the raw bid and ask strings
export const GET = withApiKey(async () => {
  try {
    const { quotes, fetchedAt } = await getQuotes(PAIRS);
    return Response.json({
      data: quotes.map(({ pair, currency, bid, ask, updatedAt }) => {
        // The API sends Brasília time with no offset (fixed -03:00 since 2019), so pin it before converting to UTC
        const time = Date.parse(updatedAt.replace(" ", "T") + "-03:00");
        return {
          pair,
          currency,
          bid,
          ask,
          updatedAt: Number.isNaN(time) ? null : new Date(time).toISOString(),
        };
      }),
      fetchedAt: new Date(fetchedAt).toISOString(),
    });
  } catch (error) {
    console.error(error); // details stay in the server logs
    return apiError(503, "PRICE_UNAVAILABLE", "Prices are unavailable right now.");
  }
});
