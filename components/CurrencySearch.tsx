"use client";

import Link from "next/link";
import { useState } from "react";
import { DeltaChip } from "@/components/DeltaChip";
import { type Currency, type CurrencyGroup, filterCurrencies, GROUPS } from "@/lib/currencies";
import { formatBRL } from "@/lib/format";

const inputClass =
  "rounded-lg border border-zinc-300 px-3 py-2 font-normal dark:border-zinc-700 dark:bg-zinc-900";

const chipBase =
  "rounded-full border px-3 py-1 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/50";

// Keyed by pair, e.g. "USD-BRL"
type Quotes = Record<string, { price: number; change: number }>;

export function CurrencySearch({ currencies, quotes }: { currencies: Currency[]; quotes?: Quotes }) {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<CurrencyGroup | null>(null);
  const matches = filterCurrencies(currencies, query).filter(
    (c) => !selected || selected.codes.includes(c.code),
  );
  const sections = GROUPS.map((group) => ({
    group,
    items: matches.filter((c) => group.codes.includes(c.code)),
  })).filter((s) => s.items.length > 0);

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

      <div role="group" aria-label="Filter by group" className="mt-4 flex flex-wrap gap-2">
        {[null, ...GROUPS].map((group) => {
          const isSelected = selected === group;
          return (
            <button
              key={group?.name ?? "all"}
              type="button"
              aria-pressed={isSelected}
              onClick={() => setSelected(group)}
              className={`${chipBase} ${
                isSelected
                  ? "border-transparent bg-brand text-white"
                  : "border-zinc-300 text-zinc-600 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-900"
              }`}
            >
              {group?.name ?? "All"}
            </button>
          );
        })}
      </div>

      {/* role="status" lets screen readers announce the new count as the query changes */}
      {/* One text node (template string), so the count reads as "52 currencies" in the HTML */}
      <p role="status" className="mt-3 text-sm text-zinc-500">
        {`${matches.length} ${matches.length === 1 ? "currency" : "currencies"}`}
      </p>

      {matches.length === 0 ? (
        <p className="mt-6 text-zinc-500">No currency matches &quot;{query}&quot;.</p>
      ) : (
        <div className="mt-6 grid gap-8">
          {sections.map(({ group, items }) => (
            <section key={group.name}>
              <h2 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                {group.name} · {items.length}
              </h2>
              <ul className="mt-3 divide-y divide-zinc-200 overflow-hidden rounded-xl border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
                {items.map((c) => {
                  const quote = quotes?.[c.pair];
                  // Rounded like QuoteCard, so the arrow and the sign match the number shown
                  const shown = quote ? Number(quote.change.toFixed(2)) : 0;
                  const sign = shown > 0 ? "+" : "";
                  return (
                    <li key={c.pair}>
                      <Link
                        href={`/currency/${c.pair}`}
                        transitionTypes={["nav-forward"]}
                        className="flex items-center gap-4 px-4 py-3 transition hover:bg-zinc-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-indigo-500/50 dark:hover:bg-zinc-900/60"
                      >
                        <span className="w-14 shrink-0 rounded-md bg-zinc-100 px-2 py-1 text-center text-xs font-semibold dark:bg-zinc-800">
                          {c.code}
                        </span>
                        <span className="min-w-0 flex-1 truncate font-medium">{c.name}</span>
                        {quote && (
                          <span className="flex shrink-0 items-center gap-3">
                            <span className="tabular-nums">{formatBRL(quote.price)}</span>
                            <DeltaChip value={shown}>{`${sign}${shown.toFixed(2)}%`}</DeltaChip>
                          </span>
                        )}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
