// Prices are in Brazilian reais, shown with English number formatting: R$5.04
// Shared with AnimatedBRL so the animated and static prices can never format differently
export function brlFormatOptions(value: number) {
  // Tiny prices (JPY, KRW) would show as R$0.00 with 2 decimals, so keep 4 significant digits
  return {
    style: "currency",
    currency: "BRL",
    ...(value !== 0 && Math.abs(value) < 1 ? { maximumSignificantDigits: 4 } : {}),
  } satisfies Intl.NumberFormatOptions;
}

export function formatBRL(value: number) {
  return value.toLocaleString("en-US", brlFormatOptions(value));
}

// Takes a plain decimal string (formatDecimal output). Small quantities keep 4 significant digits
export function formatQuantity(value: string): string {
  const n = Number(value);
  if (Math.abs(n) >= 1) return n.toLocaleString("en-US", { maximumFractionDigits: 4 });
  if (n !== 0) return n.toLocaleString("en-US", { maximumSignificantDigits: 4 });
  return "0";
}
