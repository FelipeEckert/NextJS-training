import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { FavoriteStar } from "@/components/FavoriteStar";
import { formatBRL } from "@/lib/format";
import { currencies } from "@/lib/currencies";
import { getQuote } from "@/lib/quotes";

// Tells Next which pairs exist, so it prerenders these pages at build time
export function generateStaticParams() {
  return currencies.map((c) => ({ pair: c.pair }));
}

// Not async: the page never awaits params itself, so its shell is the same for every pair
// and <Link> can prefetch it once and reuse it (instant navigation)
export default function CurrencyPage({ params }: PageProps<"/currency/[pair]">) {
  return (
    <main className="mx-auto w-full max-w-3xl p-8">
      <Link href="/" className="text-sm text-zinc-500 hover:underline">
        ← Back
      </Link>

      <Suspense fallback={<QuoteDetailsSkeleton />}>
        <QuoteDetails params={params} />
      </Suspense>
    </main>
  );
}

// Reads the URL (params), so it renders per pair, behind the Suspense boundary
async function QuoteDetails({ params }: Pick<PageProps<"/currency/[pair]">, "params">) {
  const { pair } = await params; // "USD-BRL", from the URL
  const quote = await getQuote(pair);

  // shortcut: inside Suspense this renders the not-found page but keeps status 200 (with noindex) for unknown pairs; the proxy in Hour 6 will return a real 404 before rendering
  if (!quote) notFound();

  const isUp = quote.change >= 0;

  return (
    <>
      <div className="mt-6 flex items-center justify-between">
        <h1 className="text-3xl font-bold">{quote.currency}</h1>
        <FavoriteStar pair={quote.pair} />
      </div>

      <p className="mt-4 text-5xl font-semibold tabular-nums">{formatBRL(quote.price)}</p>
      <p className={`mt-2 text-lg ${isUp ? "text-green-600" : "text-red-600"}`}>
        {isUp ? "▲" : "▼"} {quote.change.toFixed(2)}% today
      </p>

      <p className="mt-6 text-sm text-zinc-500">Updated at {quote.updatedAt}</p>
    </>
  );
}

function QuoteDetailsSkeleton() {
  return (
    <div className="mt-6 animate-pulse">
      <div className="h-9 w-64 rounded bg-zinc-200 dark:bg-zinc-800" />
      <div className="mt-4 h-12 w-48 rounded bg-zinc-200 dark:bg-zinc-800" />
      <div className="mt-2 h-6 w-32 rounded bg-zinc-200 dark:bg-zinc-800" />
    </div>
  );
}
