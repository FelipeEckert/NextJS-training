import type { Metadata } from "next";
import { CurrencySearch } from "@/components/CurrencySearch";
import { CATALOG } from "@/lib/currencies";

export const metadata: Metadata = { title: "All currencies" };

// Static page: the list is plain data, so no Suspense is needed
export default function CurrenciesPage() {
  return (
    <main className="mx-auto w-full max-w-5xl p-8">
      <h1 className="text-3xl font-bold">All currencies</h1>
      <CurrencySearch currencies={CATALOG} />
    </main>
  );
}
