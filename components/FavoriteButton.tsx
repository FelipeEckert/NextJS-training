"use client"; // ← the boundary: from here down, this also runs in the browser

import { useOptimistic } from "react";
import { setFavoriteAction } from "@/app/actions";

type FavoriteButtonProps = {
  pair: string;
  isFavorite: boolean; // the real value, read from the cookie on the server
};

export function FavoriteButton({ pair, isFavorite }: FavoriteButtonProps) {
  // Shows the new star instantly, before the server answers.
  // If the action fails, React drops it and goes back to the real value
  const [optimisticFavorite, setOptimisticFavorite] = useOptimistic(isFavorite);

  async function toggle() {
    const next = !optimisticFavorite; // decide the new state here, on the client...
    setOptimisticFavorite(next);
    await setFavoriteAction(pair, next); // ...and send it, so a retry can't flip it back
  }

  return (
    <form action={toggle}>
      <button
        type="submit"
        aria-pressed={optimisticFavorite}
        aria-label={optimisticFavorite ? "Remove from favorites" : "Add to favorites"}
        className="text-2xl text-amber-500"
      >
        {optimisticFavorite ? "★" : "☆"}
      </button>
    </form>
  );
}
