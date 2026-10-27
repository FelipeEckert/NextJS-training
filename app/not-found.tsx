import type { Metadata } from "next";
import Link from "next/link";
import { FEATURED_PAIRS, findCurrency } from "@/lib/currencies";

export const metadata: Metadata = { title: "Page not found · Exchange Rates" };

export default function NotFound() {
  return (
    <main className="mx-auto w-full max-w-3xl p-8">
      <p className="text-sm font-medium text-zinc-500">404</p>
      <h1 className="mt-2 text-3xl font-bold">Page not found</h1>
      <p className="mt-2 text-zinc-500">That page or currency doesn&apos;t exist.</p>
      <Link
        href="/"
        className="mt-6 inline-block rounded-lg bg-accent px-4 py-2 text-white hover:bg-accent-hover"
      >
        Back to home
      </Link>
      <h2 className="mt-10 text-sm font-medium text-zinc-500">Popular currencies</h2>
      <ul className="mt-3 flex flex-wrap gap-2">
        {FEATURED_PAIRS.map((pair) => (
          <li key={pair}>
            <Link
              href={`/currency/${pair}`}
              className="rounded-full border border-zinc-200 px-3 py-1 text-sm hover:bg-zinc-100 dark:border-zinc-800 dark:hover:bg-zinc-900"
            >
              {findCurrency(pair)!.label}
            </Link>
          </li>
        ))}
      </ul>
      <Link href="/currencies" className="mt-4 inline-block text-sm hover:underline">
        See all currencies →
      </Link>
    </main>
  );
}
