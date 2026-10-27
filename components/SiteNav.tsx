"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { type ReactNode, useEffect, useState } from "react";

const LINKS = [
  ["/favorites", "Favorites"],
  ["/wallet", "Wallet"],
  ["/leaderboard", "Leaderboard"],
  ["/backtest", "Backtest"],
  ["/docs/api", "API"],
  ["/currencies", "All currencies"],
] as const;

const ACTIVE =
  "whitespace-nowrap rounded-md bg-zinc-100 px-2 py-1.5 text-sm font-medium text-foreground dark:bg-zinc-800/70";
const INACTIVE =
  "whitespace-nowrap rounded-md px-2 py-1.5 text-sm font-medium text-zinc-600 hover:bg-zinc-100 hover:text-foreground dark:text-zinc-400 dark:hover:bg-zinc-800/50";

function NavList({
  pathname,
  onNavigate,
  className,
  block,
}: {
  pathname: string;
  onNavigate: () => void;
  className: string;
  block?: boolean;
}) {
  return (
    <ul className={className}>
      {LINKS.map(([href, label]) => {
        const active = pathname === href || pathname.startsWith(`${href}/`);
        return (
          <li key={href}>
            <Link
              href={href}
              aria-current={active ? "page" : undefined}
              onClick={onNavigate}
              className={`${active ? ACTIVE : INACTIVE}${block ? " block" : ""}`}
            >
              {label}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

export function SiteNav({ account }: { account: ReactNode }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open]);

  return (
    <>
      {/* lg and up: links on the left, account on the right */}
      <div className="hidden flex-1 items-center justify-between gap-3 lg:flex">
        <NavList pathname={pathname} onNavigate={close} className="flex items-center gap-1" />
        {account}
      </div>

      {/* Phones and tablets: one button, so the links do not wrap into several rows */}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-controls="mobile-nav"
        className="ml-auto flex items-center gap-2 rounded-md border border-zinc-300 px-2.5 py-1.5 text-sm font-medium lg:hidden dark:border-zinc-700"
      >
        <svg
          aria-hidden="true"
          viewBox="0 0 20 20"
          className="size-4"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
        >
          {open ? <path d="M5 5l10 10M15 5L5 15" /> : <path d="M3 6h14M3 10h14M3 14h14" />}
        </svg>
        Menu
      </button>
      {open && (
        <div
          id="mobile-nav"
          className="absolute inset-x-0 top-full border-b border-zinc-200 bg-background p-4 shadow-lg lg:hidden dark:border-zinc-800"
        >
          <NavList pathname={pathname} onNavigate={close} className="grid gap-1" block />
          <div className="mt-4 border-t border-zinc-200 pt-4 dark:border-zinc-800">{account}</div>
        </div>
      )}
    </>
  );
}
