import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import { Suspense, ViewTransition } from "react";
import { Logo } from "@/components/Logo";
import { SiteNav } from "@/components/SiteNav";
import { UserMenu } from "@/components/UserMenu";
import { ThemeToggle } from "@/components/ThemeToggle";
import "./globals.css";

const THEME_SCRIPT = `(function(){var d=document.documentElement,t;try{t=localStorage.getItem("theme")}catch(e){}d.dataset.theme=t==="light"||t==="dark"?t:matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light"})()`;

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Exchange Rates",
  description: "US dollar, euro, pound and bitcoin in Brazilian reais, updated every minute.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        {/* Runs before first paint, so a saved theme never flashes. shortcut: visitors without JS always get light */}
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body className="min-h-full flex flex-col">
        {/* Named so the header stays still during page slides */}
        <header
          style={{ viewTransitionName: "site-header" }}
          className="sticky top-0 z-20 border-b border-zinc-200 bg-background/80 backdrop-blur dark:border-zinc-800"
        >
          <nav className="relative mx-auto flex w-full max-w-5xl items-center gap-6 p-4">
            <Link href="/" className="flex shrink-0 items-center gap-2 whitespace-nowrap font-bold">
              <Logo className="size-7" />
              Exchange Rates
            </Link>
            {/* The session is per visitor, so it streams in and the rest of the layout stays static */}
            <SiteNav
              account={
                <Suspense fallback={null}>
                  <UserMenu />
                </Suspense>
              }
            />
            <ThemeToggle />
          </nav>
        </header>
        {/* Pages stay mounted (hidden) between visits, so the slide runs on the content update, not on enter/exit */}
        <ViewTransition
          update={{ "nav-forward": "nav-forward", "nav-back": "nav-back", default: "none" }}
          default="none"
        >
          {children}
        </ViewTransition>
      </body>
    </html>
  );
}
