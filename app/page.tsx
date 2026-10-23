import { QuoteCard } from "@/components/QuoteCard";
import { getQuotes } from "@/lib/quotes";

export default async function Home() {
  const quotes = await getQuotes();

  return (
    <main className="mx-auto w-full max-w-5xl p-8">
      <h1 className="text-3xl font-bold">Exchange Rates</h1>
      <p className="mt-2 text-zinc-500">Live rates in Brazilian reais, updated every minute.</p>

      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {quotes.map((q) => (
          <QuoteCard key={q.pair} {...q} />
        ))}
      </div>
    </main>
  );
}
