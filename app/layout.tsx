import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import { Suspense } from "react";
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
        <header className="border-b border-zinc-200 dark:border-zinc-800">
          <nav className="mx-auto flex w-full max-w-5xl flex-wrap items-center justify-between gap-3 p-4">
            <div className="flex items-center gap-6">
              <Link href="/" className="font-bold">
                💱 Exchange Rates
              </Link>
              <Link href="/favorites" className="text-sm font-medium hover:underline">
                Favorites
              </Link>
              <Link href="/currencies" className="text-sm font-medium hover:underline">
                All currencies
              </Link>
            </div>
            {/* The session is per visitor, so it streams in and the rest of the layout stays static */}
            <Suspense fallback={null}>
              <UserMenu />
            </Suspense>
          </nav>
        </header>
        {children}
      </body>
    </html>
  );
}
