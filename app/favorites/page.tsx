import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { QuoteCard } from "@/components/QuoteCard";
import { getFavorites } from "@/lib/favorites";
import { getQuotes } from "@/lib/quotes";
import { getCurrentUser } from "@/lib/session";

export const metadata: Metadata = { title: "Your favorites" };

export default function FavoritesPage() {
  return (
    <main className="mx-auto w-full max-w-5xl p-8">
      <h1 className="text-3xl font-bold">Your favorites</h1>
      <Suspense fallback={<p className="mt-6 text-zinc-500">Loading your favorites…</p>}>
        <FavoritesList />
      </Suspense>
    </main>
  );
}

async function FavoritesList() {
  // Defense in depth: the proxy already redirected visitors without a cookie,
  // but we never trust it alone. In March 2025 (CVE-2025-29927) attackers could skip
  // Next.js middleware with one header, and apps that checked only there were exposed.
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/favorites");

  const favorites = await getFavorites();
  // No favorites means no API call; otherwise fetch exactly the favorites, even ones outside the featured four
  const favoriteQuotes = favorites.length > 0 ? (await getQuotes(favorites)).quotes : [];

  if (favoriteQuotes.length === 0) {
    return (
      <p className="mt-6 text-zinc-500">
        No favorites yet. Tap the ☆ on any currency to add it here.
      </p>
    );
  }

  return (
    <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {favoriteQuotes.map((q) => (
        <QuoteCard key={q.pair} {...q} />
      ))}
    </div>
  );
}
