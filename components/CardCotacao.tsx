import Link from "next/link";
import { BotaoFavorito } from "./BotaoFavorito";

// "type" descreve o formato das props, e o TypeScript cobra isso
type CardCotacaoProps = {
  par: string;
  moeda: string;
  valor: number;
  variacao: number;
};

// As props chegam como um objeto, e a gente "desmonta" ele direto no parâmetro
export function CardCotacao({ par, moeda, valor, variacao }: CardCotacaoProps) {
  const subiu = variacao >= 0;

  return (
    <div className="rounded-xl border border-zinc-200 p-5 dark:border-zinc-800">
      <div className="flex items-center justify-between">
        {/* Só o nome vira link: botão dentro de link é HTML inválido */}
        <Link href={`/moeda/${par}`} className="text-sm text-zinc-500 hover:underline">
          {moeda}
        </Link>
        <BotaoFavorito />
      </div>

      <p className="mt-1 text-2xl font-semibold tabular-nums">
        {valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
      </p>

      {/* Renderização condicional com ternário: condição ? se sim : se não */}
      <p className={subiu ? "text-green-600" : "text-red-600"}>
        {subiu ? "▲" : "▼"} {variacao.toFixed(2)}%
      </p>
    </div>
  );
}
