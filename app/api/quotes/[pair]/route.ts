import { getQuote } from "@/lib/quotes";

// GET /api/quotes/USD-BRL → one quote, or 404 if the pair is not supported
export async function GET(_request: Request, ctx: RouteContext<"/api/quotes/[pair]">) {
  const { pair } = await ctx.params;

  try {
    const quote = await getQuote(pair);

    if (!quote) {
      return Response.json({ error: `Unknown pair: ${pair}` }, { status: 404 });
    }

    return Response.json({ data: quote });
  } catch (error) {
    console.error(error);
    return Response.json({ error: "Exchange rate provider is unavailable" }, { status: 502 });
  }
}
