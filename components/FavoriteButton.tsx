"use client"; // ← the boundary: from here down, this also runs in the browser

import { useState } from "react";

export function FavoriteButton() {
  const [favorite, setFavorite] = useState(false);

  return (
    <button
      type="button"
      onClick={() => setFavorite(!favorite)}
      aria-pressed={favorite}
      aria-label={favorite ? "Remove from favorites" : "Add to favorites"}
      className="text-2xl text-amber-500"
    >
      {favorite ? "★" : "☆"}
    </button>
  );
}
