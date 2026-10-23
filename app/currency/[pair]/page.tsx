import Link from "next/link";
import { notFound } from "next/navigation";
import { FavoriteButton } from "@/components/FavoriteButton";
import { formatBRL } from "@/lib/format";
import { currencies, getQuote } from "@/lib/quotes";

// Tells Next which pairs exist, so it prerenders these pages at build time
export function generateStaticParams() {
  return currencies.map((c) => ({ pair: c.pair }));
}

export default async function CurrencyPage({ params }: PageProps<"/currency/[pair]">) {
  const { pair } = await params; // "USD-BRL", from the URL
  const quote = await getQuote(pair);

  if (!quote) notFound(); // pair not in the allowlist → 404

  const isUp = quote.change >= 0;

  return (
    <main className="mx-auto w-full max-w-3xl p-8">
      <Link href="/" className="text-sm text-zinc-500 hover:underline">
        ← Back
      </Link>

      <div className="mt-6 flex items-center justify-between">
        <h1 className="text-3xl font-bold">{quote.currency}</h1>
        <FavoriteButton />
      </div>

      <p className="mt-4 text-5xl font-semibold tabular-nums">{formatBRL(quote.price)}</p>
      <p className={`mt-2 text-lg ${isUp ? "text-green-600" : "text-red-600"}`}>
        {isUp ? "▲" : "▼"} {quote.change.toFixed(2)}% today
      </p>

      <p className="mt-6 text-sm text-zinc-500">Updated at {quote.updatedAt}</p>
    </main>
  );
}
