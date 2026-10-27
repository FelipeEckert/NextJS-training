import { io } from "next/cache";
import Link from "next/link";
import { QuoteCard } from "@/components/QuoteCard";
import { RefreshButton } from "@/components/RefreshButton";
import { getQuotes } from "@/lib/quotes";

export default async function Home() {
  // Fetch at request time, not during the build: if the API refuses the build server, the deploy
  // still succeeds and visitors see the loading.tsx skeleton until the (cached) data arrives
  await io();
  const { quotes, fetchedAt } = await getQuotes();

  // Server time zone can differ (e.g. UTC on Vercel), so we pin Brazil's
  const fetchedTime = new Date(fetchedAt).toLocaleTimeString("en-US", {
    timeZone: "America/Sao_Paulo",
  });

  return (
    <main className="mx-auto w-full max-w-5xl p-8">
      <h1 className="text-3xl font-bold">Exchange Rates</h1>
      <p className="mt-2 text-zinc-500">Live rates in Brazilian reais, updated every minute.</p>
      <Link href="/currencies" className="mt-2 inline-block text-sm font-medium hover:underline">
        Browse all 52 currencies →
      </Link>

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
