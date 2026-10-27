import type { ReactNode } from "react";
import { Logo } from "@/components/Logo";

type Props = { title: string; subtitle: string; children: ReactNode };

export function AuthShell({ title, subtitle, children }: Props) {
  return (
    <main className="mx-auto grid w-full max-w-5xl flex-1 items-center gap-12 p-8 lg:grid-cols-2">
      <div className="mx-auto w-full max-w-sm">
        <h1 className="text-2xl font-bold">{title}</h1>
        <p className="mt-2 text-sm text-zinc-500">{subtitle}</p>
        {children}
      </div>

      <aside
        aria-label="About Exchange Rates"
        className="relative isolate hidden min-h-[520px] flex-col justify-between overflow-hidden rounded-3xl bg-brand p-10 text-white shadow-xl shadow-indigo-500/20 lg:flex"
      >
        <div aria-hidden="true" className="absolute -right-16 -top-16 -z-10 size-64 rounded-full bg-white/15 blur-3xl" />
        <div aria-hidden="true" className="absolute -bottom-20 -left-10 -z-10 size-72 rounded-full bg-sky-400/25 blur-3xl" />

        <Logo className="size-10 rounded-lg ring-1 ring-white/30" />

        <div>
          <p className="text-3xl font-semibold leading-tight tracking-tight">
            R$ 100,000 of virtual cash.
            <br />
            Live prices. Zero risk.
          </p>
          <ul className="mt-6 grid gap-3 text-sm">
            <li className="flex items-center gap-2">
              <CheckIcon />
              Trade 52 currencies and crypto at live prices
            </li>
            <li className="flex items-center gap-2">
              <CheckIcon />
              Backtest a strategy over the last year
            </li>
            <li className="flex items-center gap-2">
              <CheckIcon />
              Climb the leaderboard
            </li>
          </ul>
        </div>

        <div aria-hidden="true" className="rounded-2xl bg-white/10 p-5 ring-1 ring-white/20 backdrop-blur">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium">Your wallet</span>
            <span className="rounded-full bg-white/20 px-2 py-0.5 text-[11px] font-semibold">Paper</span>
          </div>
          <p className="mt-1.5 text-xs">Virtual cash</p>
          <p className="mt-0.5 text-2xl font-semibold tabular-nums">R$100,072.34</p>
          <p className="mt-1 text-xs font-medium">+0.07% since you started</p>
        </div>
      </aside>
    </main>
  );
}

function CheckIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="size-4 shrink-0" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 12.5l4.5 4.5L19 7.5" />
    </svg>
  );
}
