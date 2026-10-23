import { PAIRS } from "@/lib/currencies";
import { getQuotes } from "@/lib/quotes";

// GET /api/quotes                        → all quotes
// GET /api/quotes?pairs=USD-BRL,EUR-BRL  → only those pairs
export async function GET(request: Request) {
  const requested = new URL(request.url).searchParams
    .get("pairs")
    ?.toUpperCase()
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean);

  // Validate input before doing any work: reject pairs outside the allowlist
  const allowed = PAIRS;
  const invalid = requested?.filter((p) => !allowed.includes(p)) ?? [];
  if (invalid.length > 0) {
    return Response.json(
      { error: `Unknown pair(s): ${invalid.join(", ")}`, allowed },
      { status: 400 },
    );
  }

  try {
    // One cached fetch covers all pairs, then we filter it to the requested ones (none means the featured set)
    const { quotes, fetchedAt } = await getQuotes(requested?.length ? requested : undefined);
    return Response.json({ data: quotes, fetchedAt: new Date(fetchedAt).toISOString() });
  } catch (error) {
    console.error(error); // full details stay in the server logs, never in the response
    // 502 Bad Gateway = "a service I depend on failed", not "I failed" (that would be 500)
    return Response.json({ error: "Exchange rate provider is unavailable" }, { status: 502 });
  }
}
