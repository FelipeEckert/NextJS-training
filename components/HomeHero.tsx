import Link from "next/link";
import { Suspense } from "react";
import { tryDemo } from "@/app/auth-actions";
import { getCurrentUser } from "@/lib/session";

export function HomeHero() {
  return (
    <section className="relative isolate mt-6 overflow-hidden rounded-3xl border border-zinc-200 px-6 py-14 sm:px-12 dark:border-zinc-800">
      {/* Decorative glow; it drifts slowly only when motion is allowed */}
      <div aria-hidden="true" className="hero-glow pointer-events-none absolute inset-0 -z-10">
        <div className="absolute -left-20 -top-24 size-80 rounded-full bg-indigo-500/25 blur-3xl dark:bg-indigo-500/20" />
        <div className="absolute -bottom-28 right-0 size-96 rounded-full bg-violet-500/20 blur-3xl dark:bg-violet-500/15" />
      </div>
      <p className="inline-flex items-center gap-2 rounded-full border border-zinc-200 bg-background/60 px-3 py-1 text-xs font-medium text-zinc-600 backdrop-blur dark:border-zinc-800 dark:text-zinc-400">
        <span aria-hidden="true" className="size-1.5 rounded-full bg-green-500" /> Live quotes · Paper trading
      </p>
      <h1 className="mt-5 max-w-2xl text-4xl font-bold tracking-tight sm:text-5xl">
        Paper-trade currencies <span className="text-brand">in BRL</span>
      </h1>
      <p className="mt-4 max-w-xl text-lg text-zinc-600 dark:text-zinc-400">
        Start with R$ 100,000 of virtual cash. Trade 52 currencies and crypto at live prices, backtest a strategy and climb the leaderboard.
      </p>
      <Suspense fallback={<div className="mt-8 h-10" />}>
        <HeroActions />
      </Suspense>
    </section>
  );
}

// Reads the session cookie, so it renders inside <Suspense>
async function HeroActions() {
  const user = await getCurrentUser();

  if (!user) {
    return (
      <div className="mt-8 flex flex-wrap gap-3">
        <Link href="/signup" className="rounded-lg bg-brand px-5 py-2.5 font-medium text-white shadow-md shadow-indigo-500/20 hover:brightness-110">Start trading</Link>
        <form action={tryDemo}>
          <button type="submit" className="rounded-lg border border-zinc-300 bg-background/60 px-5 py-2.5 font-medium hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-900">Try the demo</button>
        </form>
      </div>
    );
  }

  return (
    <div className="mt-8 flex flex-wrap items-center gap-3">
      <Link href="/wallet" className="rounded-lg bg-brand px-5 py-2.5 font-medium text-white shadow-md shadow-indigo-500/20 hover:brightness-110">Open your wallet</Link>
      <Link href="/backtest" className="rounded-lg border border-zinc-300 bg-background/60 px-5 py-2.5 font-medium hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-900">Backtest a strategy</Link>
      <span className="text-sm text-zinc-500">Welcome back, {user.username}</span>
    </div>
  );
}
