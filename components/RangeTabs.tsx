import Link from "next/link";
import { RANGES, type Range } from "@/lib/analysis";

// Plain links, so each range is a URL and works without JavaScript
export function RangeTabs({ pair, active }: { pair: string; active: Range }) {
  return (
    <nav aria-label="Chart range" className="mt-6 flex gap-2">
      {RANGES.map((range) => {
        const isActive = range === active;

        return (
          <Link
            key={range}
            href={`/currency/${pair}?range=${range}`}
            aria-current={isActive ? "page" : undefined}
            className={`rounded-full px-3 py-1 text-sm ${
              isActive
                ? "bg-brand text-white"
                : "text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"
            }`}
          >
            {range}
          </Link>
        );
      })}
    </nav>
  );
}
