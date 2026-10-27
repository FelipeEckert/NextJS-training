import { describe, expect, it } from "vitest";
import { formatBRL, formatQuantity } from "./format";

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

describe("formatQuantity", () => {
  it("keeps up to 4 decimals for quantities of 1 or more", () => {
    expect(formatQuantity("18.6140014518")).toBe("18.614");
    expect(formatQuantity("201.3693113169")).toBe("201.3693");
    expect(formatQuantity("1")).toBe("1");
    expect(formatQuantity("1500.5")).toBe("1,500.5");
  });
  it("shows 4 significant digits for quantities below 1", () => {
    expect(formatQuantity("0.0002345678")).toBe("0.0002346");
  });
  it("shows zero as 0", () => {
    expect(formatQuantity("0")).toBe("0");
  });
});
