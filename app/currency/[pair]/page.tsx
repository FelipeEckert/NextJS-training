import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense, ViewTransition, type ReactNode } from "react";
import { DeltaChip } from "@/components/DeltaChip";
import { FavoriteStar } from "@/components/FavoriteStar";
import { PriceChart } from "@/components/PriceChart";
import { RangeTabs } from "@/components/RangeTabs";
import { TradePanel } from "@/components/TradePanel";
import { parseRange, sliceRange, summarize } from "@/lib/analysis";
import { formatBRL } from "@/lib/format";
import { FEATURED_PAIRS, findCurrency } from "@/lib/currencies";
import { getHistory } from "@/lib/history";

// Tells Next which pairs exist, so it prerenders these pages at build time
export function generateStaticParams() {
  return FEATURED_PAIRS.map((pair) => ({ pair }));
}

// Not async: the page never awaits params itself, so its shell is the same for every pair
// and <Link> can prefetch it once and reuse it (instant navigation)
export default function CurrencyPage({ params, searchParams }: PageProps<"/currency/[pair]">) {
  return (
    <main className="mx-auto w-full max-w-3xl p-8">
      {/* Inside main, not on it, so the padding and width stay put while the content slides */}
      <ViewTransition
        enter={{ "nav-forward": "nav-forward", "nav-back": "nav-back", default: "none" }}
        exit={{ "nav-forward": "nav-forward", "nav-back": "nav-back", default: "none" }}
        default="none"
      >
        <Link
          href="/"
          transitionTypes={["nav-back"]}
          className="text-sm text-zinc-500 hover:underline"
        >
          ← Back
        </Link>

        <Suspense fallback={<QuoteDetailsSkeleton />}>
          <CurrencyDetails params={params} searchParams={searchParams} />
        </Suspense>
      </ViewTransition>
    </main>
  );
}

// Reads the URL (params and ?range=), so it renders per pair, behind the Suspense boundary
async function CurrencyDetails({
  params,
  searchParams,
}: Pick<PageProps<"/currency/[pair]">, "params" | "searchParams">) {
  const { pair } = await params; // "usd-brl" or "USD-BRL", from the URL
  const sp = await searchParams;
  // A repeated ?range=a&range=b arrives as an array, so only a single string counts
  const range = parseRange(typeof sp.range === "string" ? sp.range : undefined);

  // The proxy already rejects unknown pairs; this check narrows the type
  const currency = findCurrency(pair);
  if (!currency) notFound();

  // Always pass currency.pair, never the raw URL value: getHistory only accepts exact catalog pairs
  const history = await getHistory(currency.pair);

  if (history.length === 0) {
    return (
      <>
        <h1 className="mt-6 text-3xl font-bold">{currency.label}</h1>
        <p className="mt-4 text-zinc-500">No price history available for this currency.</p>
      </>
    );
  }

  const points = sliceRange(history, range);
  const summary = summarize(points)!; // points is never empty when history is not
  const latest = history.at(-1)!;
  // Live intraday price: noon UTC keeps its date from reading as tomorrow in Brasília
  const latestDay = new Date(Date.parse(latest.date + "T12:00:00Z")).toLocaleDateString("en-US", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "short",
    day: "numeric",
  });
  // Direction comes from the rounded percent, so the R$ change and the percent always agree
  const percent = Number(summary.changePct.toFixed(2));
  // Show "+" only for a real gain, so a flat period reads as zero
  const sign = percent > 0 ? "+" : "";

  return (
    <>
      <div className="mt-6 flex items-center justify-between">
        <h1 className="text-3xl font-bold">{currency.label}</h1>
        <FavoriteStar pair={currency.pair} />
      </div>

      {/* Same name as the home card's price, so the number morphs between the two pages */}
      <ViewTransition name={`price-${currency.pair}`} share="morph" default="none">
        <p className="mt-4 text-5xl font-semibold tabular-nums">{formatBRL(latest.close)}</p>
      </ViewTransition>
      <p className="mt-2 text-sm text-zinc-500">Latest price on {latestDay}</p>

      {/* Reads the session cookie, so it streams in on its own */}
      <Suspense fallback={null}>
        <TradePanel pair={currency.pair} code={currency.code} />
      </Suspense>

      <RangeTabs pair={currency.pair} active={range} />
      {/* Keyed by range so changing the range crossfades the chart instead of swapping it */}
      <ViewTransition key={range} name="price-chart" share="auto" enter="auto" default="none">
        <PriceChart points={points} />
      </ViewTransition>

      <dl className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3">
        <Stat label="Change">
          <DeltaChip value={percent}>
            {`${sign}${formatBRL(summary.change)} (${sign}${summary.changePct.toFixed(2)}%)`}
          </DeltaChip>
        </Stat>
        <Stat label="Low">{formatBRL(summary.min)}</Stat>
        <Stat label="High">{formatBRL(summary.max)}</Stat>
        <Stat label="Average">{formatBRL(summary.average)}</Stat>
        <Stat label="Volatility">{`${summary.volatility.toFixed(2)}% / day`}</Stat>
      </dl>
    </>
  );
}

function Stat({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
      <dt className="text-sm text-zinc-500">{label}</dt>
      <dd className="mt-1 text-lg font-semibold tabular-nums">{children}</dd>
    </div>
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
