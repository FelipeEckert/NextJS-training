import Link from "next/link";
import { Suspense } from "react";
import { AnimatedBRL } from "./AnimatedBRL";
import { DeltaChip } from "./DeltaChip";
import { FavoriteStar } from "./FavoriteStar";
import { Sparkline } from "./Sparkline";

// "type" describes the shape of the props, and TypeScript enforces it
type QuoteCardProps = {
  pair: string;
  currency: string;
  price: number;
  change: number;
};

// Props arrive as one object, which we destructure right in the parameter
export function QuoteCard({ pair, currency, price, change }: QuoteCardProps) {
  // Rounded like the text, so the arrow and the sign never disagree with the number shown
  const shown = Number(change.toFixed(2));
  const sign = shown > 0 ? "+" : "";

  return (
    <div className="group relative rounded-xl border border-zinc-200 p-5 transition duration-200 hover:border-indigo-300/70 hover:shadow-lg hover:shadow-indigo-500/10 focus-within:ring-2 focus-within:ring-indigo-500/50 motion-safe:hover:-translate-y-0.5 dark:border-zinc-800 dark:hover:border-indigo-500/40">
      <div className="flex items-center justify-between">
        {/* Only the name is a link: a button inside a link is invalid HTML */}
        {/* The link's ::after covers the card, so the whole card navigates; the name stays the one link */}
        <Link
          href={`/currency/${pair}`}
          transitionTypes={["nav-forward"]}
          className="text-sm text-zinc-500 after:absolute after:inset-0 after:rounded-xl after:content-[''] group-hover:text-foreground focus-visible:outline-none"
        >
          {currency}
        </Link>
        <div className="relative z-10">
          <FavoriteStar pair={pair} />
        </div>
      </div>

      <p className="mt-1 text-2xl font-semibold tabular-nums">
        <AnimatedBRL value={price} />
      </p>

      <p>
        <DeltaChip value={shown}>{`${sign}${shown.toFixed(2)}%`}</DeltaChip>
      </p>

      {/* Streams in after the card, so a slow history call never delays the prices */}
      <Suspense fallback={<div className="mt-3 h-10" aria-hidden="true" />}>
        <Sparkline pair={pair} />
      </Suspense>
    </div>
  );
}
