"use client"; // ← a fronteira: daqui pra baixo, roda também no navegador

import { useState } from "react";

export function BotaoFavorito() {
    const [favorito, setFavorito] = useState(false);
    console.log("rodei no BOTÃO")
    return (
        <button
            type="button"
            onClick={() => setFavorito(!favorito)}
            aria-pressed={favorito}
            aria-label={favorito ? "Remover dos favoritos" : "Adicionar aos favoritos"}
            className="text-2xl text-amber-500"
        >
            {favorito ? "★" : "☆"}
        </button>
    );
}