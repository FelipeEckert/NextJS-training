import { describe, expect, it } from "vitest";
import { CATALOG, FEATURED_PAIRS, PAIRS, filterCurrencies, findCurrency } from "./currencies";

describe("catalog", () => {
  it("has 52 unique currencies quoted in BRL", () => {
    expect(CATALOG).toHaveLength(52);
    expect(new Set(CATALOG.map((c) => c.code)).size).toBe(52);
    for (const c of CATALOG) {
      expect(c.pair).toBe(`${c.code}-BRL`);
      expect(c.label).toBe(`${c.name} (${c.code})`);
    }
    expect(PAIRS).toEqual(CATALOG.map((c) => c.pair));
  });

  it("features four pairs that are all in the catalog", () => {
    expect(FEATURED_PAIRS).toEqual(["USD-BRL", "EUR-BRL", "BTC-BRL", "GBP-BRL"]);
    for (const p of FEATURED_PAIRS) expect(PAIRS).toContain(p);
  });
});

describe("findCurrency", () => {
  it("finds a pair in any letter case", () => {
    expect(findCurrency("usd-brl")?.label).toBe("US Dollar (USD)");
  });

  it("returns undefined for unknown pairs", () => {
    expect(findCurrency("XYZ-BRL")).toBeUndefined();
  });
});

describe("filterCurrencies", () => {
  it("matches the name, case-insensitively", () => {
    expect(filterCurrencies(CATALOG, "yen").map((c) => c.code)).toEqual(["JPY"]);
  });

  it("matches the code and trims the query", () => {
    expect(filterCurrencies(CATALOG, "  jpy ").map((c) => c.code)).toEqual(["JPY"]);
  });

  it("returns every currency for an empty query", () => {
    expect(filterCurrencies(CATALOG, "   ")).toEqual(CATALOG);
  });

  it("keeps catalog order", () => {
    expect(filterCurrencies(CATALOG, "dollar").map((c) => c.code).slice(0, 3)).toEqual([
      "USD",
      "CAD",
      "AUD",
    ]);
  });
});
