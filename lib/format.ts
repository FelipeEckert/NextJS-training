// Prices are in Brazilian reais, shown with English number formatting: R$5.04
export function formatBRL(value: number) {
  return value.toLocaleString("en-US", { style: "currency", currency: "BRL" });
}
