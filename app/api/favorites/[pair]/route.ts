import { getFavorites, PairSchema, setFavorite } from "@/lib/favorites";

// PUT    /api/favorites/USD-BRL → add it    (idempotent: calling it twice is the same as once)
// DELETE /api/favorites/USD-BRL → remove it (idempotent too)

export async function PUT(_request: Request, ctx: RouteContext<"/api/favorites/[pair]">) {
  return update(ctx, true);
}

export async function DELETE(_request: Request, ctx: RouteContext<"/api/favorites/[pair]">) {
  return update(ctx, false);
}

async function update(ctx: RouteContext<"/api/favorites/[pair]">, favorite: boolean) {
  const { pair } = await ctx.params;
  const parsed = PairSchema.safeParse(pair.toUpperCase());

  if (!parsed.success) {
    return Response.json({ error: `Unknown pair: ${pair}` }, { status: 404 });
  }

  await setFavorite(parsed.data, favorite); // same logic as the Server Action
  return Response.json({ data: await getFavorites() });
}
