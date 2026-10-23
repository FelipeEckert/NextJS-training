// Prices are in Brazilian reais, shown with English number formatting: R$5.04
export function formatBRL(value: number) {
  // Tiny prices (JPY, KRW) would show as R$0.00 with 2 decimals, so keep 4 significant digits
  return value.toLocaleString("en-US", {
    style: "currency",
    currency: "BRL",
    ...(value !== 0 && Math.abs(value) < 1 ? { maximumSignificantDigits: 4 } : {}),
  });
}
