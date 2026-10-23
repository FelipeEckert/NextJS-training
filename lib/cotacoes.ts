import { cacheLife } from "next/cache";

export type Cotacao = {
  par: string;
  moeda: string;
  valor: number;
  variacao: number;
  atualizadoEm: string;
};

// Os pares que o painel aceita. Também funciona como "lista branca":
// nunca repassamos pra API externa um par que não esteja aqui
export const moedas = [
  { par: "USD-BRL", moeda: "Dólar (USD)" },
  { par: "EUR-BRL", moeda: "Euro (EUR)" },
  { par: "BTC-BRL", moeda: "Bitcoin (BTC)" },
  { par: "GBP-BRL", moeda: "Libra Esterlina (GBP)" },
];

// Só os campos da resposta que a gente usa. Os números vêm como texto
type RespostaApi = Record<string, { bid: string; pctChange: string; create_date: string }>;

export async function getCotacoes(): Promise<Cotacao[]> {
  "use cache";
  cacheLife("minutes"); // no máximo 1 chamada por minuto pra API, não importa quantos visitantes

  const pares = moedas.map((m) => m.par).join(",");
  const res = await fetch(`https://economia.awesomeapi.com.br/json/last/${pares}`);

  if (!res.ok) throw new Error(`AwesomeAPI respondeu ${res.status}`);

  const dados: RespostaApi = await res.json();

  return moedas.map((m) => {
    const d = dados[m.par.replace("-", "")]; // a API usa "USDBRL", sem hífen
    return {
      ...m,
      valor: Number(d.bid),
      variacao: Number(d.pctChange),
      atualizadoEm: d.create_date,
    };
  });
}

export async function getCotacao(par: string) {
  const cotacoes = await getCotacoes(); // reaproveita o cache: não faz outra chamada
  return cotacoes.find((c) => c.par === par.toUpperCase());
}