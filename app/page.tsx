import { io } from "next/cache";
import Link from "next/link";
import { DeltaChip } from "@/components/DeltaChip";
import { HomeHero } from "@/components/HomeHero";
import { QuoteCard } from "@/components/QuoteCard";
import { RefreshButton } from "@/components/RefreshButton";
import { TickerTape } from "@/components/TickerTape";
import { formatBRL } from "@/lib/format";
import { findCurrency, TICKER_PAIRS } from "@/lib/currencies";
import { getQuotes } from "@/lib/quotes";

export default async function Home() {
  // Fetch at request time, not during the build: if the API refuses the build server, the deploy
  // still succeeds and visitors see the loading.tsx skeleton until the (cached) data arrives
  await io();
  const { quotes, fetchedAt } = await getQuotes();
  const { quotes: tickerQuotes } = await getQuotes(TICKER_PAIRS);

  // Server time zone can differ (e.g. UTC on Vercel), so we pin Brazil's
  const fetchedTime = new Date(fetchedAt).toLocaleTimeString("en-US", {
    timeZone: "America/Sao_Paulo",
  });

  return (
    <main className="mx-auto w-full max-w-5xl p-8">
      {tickerQuotes.length > 0 && (
        <TickerTape>
          {tickerQuotes.map((q) => {
            const shown = Number(q.change.toFixed(2));
            return (
              <li key={q.pair} className="flex items-center gap-2 whitespace-nowrap text-sm">
                <span className="font-medium">{findCurrency(q.pair)!.code}</span>
                <span className="tabular-nums">{formatBRL(q.price)}</span>
                <DeltaChip value={shown}>{`${shown > 0 ? "+" : ""}${shown.toFixed(2)}%`}</DeltaChip>
              </li>
            );
          })}
        </TickerTape>
      )}
      <HomeHero />
      <h2 className="mt-14 text-2xl font-semibold">Live rates</h2>
      <p className="mt-2 text-zinc-500">In Brazilian reais, updated every minute.</p>
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
