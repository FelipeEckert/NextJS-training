import { describe, expect, it } from "vitest";
import { formatBRL } from "./format";

describe("formatBRL", () => {
  it("shows 4 significant digits for small values so JPY and KRW prices are not 0.00", () => {
    expect(formatBRL(0.031764)).toBe("R$0.03176");
    expect(formatBRL(-0.000812)).toBe("-R$0.000812");
  });
  it("keeps 2 decimals for values of 1 or more", () => {
    expect(formatBRL(4.98)).toBe("R$4.98");
    expect(formatBRL(405921)).toBe("R$405,921.00");
  });
  it("shows zero as R$0.00", () => {
    expect(formatBRL(0)).toBe("R$0.00");
  });
});
