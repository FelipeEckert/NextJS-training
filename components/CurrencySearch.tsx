"use client";

import Link from "next/link";
import { useState } from "react";
import { type Currency, filterCurrencies } from "@/lib/currencies";

const inputClass =
  "rounded-lg border border-zinc-300 px-3 py-2 font-normal dark:border-zinc-700 dark:bg-zinc-900";

export function CurrencySearch({ currencies }: { currencies: Currency[] }) {
  const [query, setQuery] = useState("");
  const matches = filterCurrencies(currencies, query);

  return (
    <div className="mt-6">
      <label className="grid gap-1 text-sm font-medium">
        Search by name or code
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className={inputClass}
        />
      </label>

      {/* role="status" lets screen readers announce the new count as the query changes */}
      {/* One text node (template string), so the count reads as "52 currencies" in the HTML */}
      <p role="status" className="mt-3 text-sm text-zinc-500">
        {`${matches.length} ${matches.length === 1 ? "currency" : "currencies"}`}
      </p>

      {matches.length === 0 ? (
        <p className="mt-6 text-zinc-500">No currency matches &quot;{query}&quot;.</p>
      ) : (
        <ul className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {matches.map((c) => (
            <li key={c.pair}>
              <Link
                href={`/currency/${c.pair}`}
                className="block rounded-xl border border-zinc-200 p-5 hover:underline dark:border-zinc-800"
              >
                {c.label}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
