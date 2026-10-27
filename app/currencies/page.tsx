import type { Metadata } from "next";
import { io } from "next/cache";
import { Suspense } from "react";
import { CurrencySearch } from "@/components/CurrencySearch";
import { CATALOG, PAIRS } from "@/lib/currencies";
import { getQuotes, type Quote } from "@/lib/quotes";

export const metadata: Metadata = { title: "All currencies" };

// The list renders at once from static data; prices stream in when the (cached) quotes arrive
export default function CurrenciesPage() {
  return (
    <main className="mx-auto w-full max-w-3xl p-8">
      <h1 className="text-3xl font-bold">All currencies</h1>
      <p className="mt-2 text-zinc-500">Live prices in Brazilian reais, updated every minute.</p>
      <Suspense fallback={<CurrencySearch currencies={CATALOG} />}>
        <PricedCurrencySearch />
      </Suspense>
    </main>
  );
}

async function PricedCurrencySearch() {
  await io(); // request time, not build time: same reason as app/page.tsx
  const { quotes } = await getQuotes(PAIRS).catch(() => ({ quotes: [] as Quote[] }));
  const prices = Object.fromEntries(quotes.map((q) => [q.pair, { price: q.price, change: q.change }]));
  return <CurrencySearch currencies={CATALOG} quotes={prices} />;
}
