import Link from "next/link";
import { notFound } from "next/navigation";
import { BotaoFavorito } from "@/components/BotaoFavorito";
import { getCotacao, moedas } from "@/lib/cotacoes";

// Diz ao Next quais pares existem, pra ele gerar essas páginas prontas no build
export function generateStaticParams() {
  return moedas.map((m) => ({ par: m.par }));
}

export default async function PaginaMoeda({ params }: PageProps<"/moeda/[par]">) {
  const { par } = await params; // "USD-BRL", vindo da URL
  const cotacao = await getCotacao(par);

  if (!cotacao) notFound(); // par fora da lista branca → 404

  const subiu = cotacao.variacao >= 0;

  return (
    <main className="mx-auto w-full max-w-3xl p-8">
      <Link href="/" className="text-sm text-zinc-500 hover:underline">
        ← Voltar
      </Link>

      <div className="mt-6 flex items-center justify-between">
        <h1 className="text-3xl font-bold">{cotacao.moeda}</h1>
        <BotaoFavorito />
      </div>

      <p className="mt-4 text-5xl font-semibold tabular-nums">
        {cotacao.valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
      </p>
      <p className={`mt-2 text-lg ${subiu ? "text-green-600" : "text-red-600"}`}>
        {subiu ? "▲" : "▼"} {cotacao.variacao.toFixed(2)}% hoje
      </p>

      <p className="mt-6 text-sm text-zinc-500">Atualizado em {cotacao.atualizadoEm}</p>
    </main>
  );
}
