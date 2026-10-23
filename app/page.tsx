import { QuoteCard } from "@/components/QuoteCard";
import { RefreshButton } from "@/components/RefreshButton";
import { getQuotes } from "@/lib/quotes";

export default async function Home() {
  const { quotes, fetchedAt } = await getQuotes();

  // Server time zone can differ (e.g. UTC on Vercel), so we pin Brazil's
  const fetchedTime = new Date(fetchedAt).toLocaleTimeString("en-US", {
    timeZone: "America/Sao_Paulo",
  });

  return (
    <main className="mx-auto w-full max-w-5xl p-8">
      <h1 className="text-3xl font-bold">Exchange Rates</h1>
      <p className="mt-2 text-zinc-500">Live rates in Brazilian reais, updated every minute.</p>

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-zinc-500">Last fetched at {fetchedTime} (Brasília time)</p>
        <RefreshButton />
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {quotes.map((q) => (
          <QuoteCard key={q.pair} {...q} />
        ))}
      </div>
    </main>
  );
}
