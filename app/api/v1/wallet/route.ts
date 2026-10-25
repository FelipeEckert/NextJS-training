import { withApiKey } from "@/lib/api";
import { averageCost } from "@/lib/api-orders";
import { getQuotes } from "@/lib/quotes";
import { centsToBrl, formatDecimal, parseDecimal, QTY_SCALE } from "@/lib/money";
import { valuePortfolio } from "@/lib/portfolio";
import { getWallet } from "@/lib/trading";

// GET /api/v1/wallet → cash, positions and total; values are null when quotes are unavailable
export const GET = withApiKey(async (_request, _ctx, auth) => {
  const wallet = await getWallet(auth.userId);

  // Prices only for held pairs. If the quote API is down, value fields are null instead of failing
  const bids = new Map<string, bigint>();
  if (wallet.positions.length > 0) {
    try {
      const { quotes } = await getQuotes(wallet.positions.map((position) => position.pair));
      for (const quote of quotes) {
        const bid = parseDecimal(quote.bid, QTY_SCALE);
        if (bid !== null) bids.set(quote.pair, bid);
      }
    } catch (error) {
      console.error(error);
    }
  }

  const { rows, totalCents, returnPct } = valuePortfolio(
    wallet.cashCents,
    wallet.positions,
    bids,
  );

  return Response.json({
    data: {
      cash: centsToBrl(wallet.cashCents),
      startedAt: wallet.startedAt.toISOString(),
      positions: rows.map((row) => ({
        pair: row.pair,
        quantity: formatDecimal(row.quantity, QTY_SCALE),
        averageCost: averageCost(row.costCents, row.quantity),
        value: row.valueCents === null ? null : centsToBrl(row.valueCents),
      })),
      total: totalCents === null ? null : centsToBrl(totalCents),
      returnPct,
    },
  });
});
