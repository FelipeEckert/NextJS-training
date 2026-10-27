import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import { Suspense, ViewTransition } from "react";
import { Logo } from "@/components/Logo";
import { SiteNav } from "@/components/SiteNav";
import { UserMenu } from "@/components/UserMenu";
import "./globals.css";

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
    >
      <body className="min-h-full flex flex-col">
        {/* Named so the header stays still during page slides */}
        <header
          style={{ viewTransitionName: "site-header" }}
          className="sticky top-0 z-20 border-b border-zinc-200 bg-background/80 backdrop-blur dark:border-zinc-800"
        >
          <nav className="relative mx-auto flex w-full max-w-5xl items-center gap-6 p-4">
            <Link href="/" className="flex items-center gap-2 font-bold">
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
