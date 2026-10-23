import { Suspense } from "react";
import { getFavorites } from "@/lib/favorites";
import { FavoriteButton } from "./FavoriteButton";

// The star depends on each visitor's cookie, so it streams in on its own.
// Everything around it (the cached quotes) stays in the fast static shell
export function FavoriteStar({ pair }: { pair: string }) {
  return (
    <Suspense fallback={<span className="text-2xl text-zinc-300 dark:text-zinc-700">☆</span>}>
      <FavoriteStatus pair={pair} />
    </Suspense>
  );
}

async function FavoriteStatus({ pair }: { pair: string }) {
  const favorites = await getFavorites(); // reads cookies() → request-time data
  return <FavoriteButton pair={pair} isFavorite={favorites.includes(pair)} />;
}
