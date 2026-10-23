import { CardCotacao } from "@/components/CardCotacao";
import { getCotacoes } from "@/lib/cotacoes";

export default async function Home() {
  const cotacoes = await getCotacoes();

  return (
    <main className="mx-auto w-full max-w-5xl p-8">
      <h1 className="text-3xl font-bold">Painel de Cotações</h1>
      <p className="mt-2 text-zinc-500">Cotações em reais, atualizadas a cada minuto.</p>

      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cotacoes.map((c) => (
          <CardCotacao key={c.par} {...c} />
        ))}
      </div>
    </main>
  );
}