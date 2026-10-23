import Link from "next/link";
import { FavoriteButton } from "./FavoriteButton";
import { formatBRL } from "@/lib/format";

// "type" describes the shape of the props, and TypeScript enforces it
type QuoteCardProps = {
  pair: string;
  currency: string;
  price: number;
  change: number;
};

// Props arrive as one object, which we destructure right in the parameter
export function QuoteCard({ pair, currency, price, change }: QuoteCardProps) {
  const isUp = change >= 0;

  return (
    <div className="rounded-xl border border-zinc-200 p-5 dark:border-zinc-800">
      <div className="flex items-center justify-between">
        {/* Only the name is a link: a button inside a link is invalid HTML */}
        <Link href={`/currency/${pair}`} className="text-sm text-zinc-500 hover:underline">
          {currency}
        </Link>
        <FavoriteButton />
      </div>

      <p className="mt-1 text-2xl font-semibold tabular-nums">{formatBRL(price)}</p>

      {/* Conditional rendering with a ternary: condition ? if true : if false */}
      <p className={isUp ? "text-green-600" : "text-red-600"}>
        {isUp ? "▲" : "▼"} {change.toFixed(2)}%
      </p>
    </div>
  );
}
