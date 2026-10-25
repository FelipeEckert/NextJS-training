import { describe, expect, it } from "vitest";
import { buildLinePath } from "./chart";

describe("buildLinePath", () => {
  it("scales values to the box (higher value = smaller y)", () => {
    expect(buildLinePath([1, 2, 3], 100, 50)).toBe("M0,50 L50,25 L100,0");
  });
  it("draws a flat middle line when all values are equal", () => {
    expect(buildLinePath([5, 5], 100, 50)).toBe("M0,25 L100,25");
  });
  it("scales against a given domain instead of the values' own range", () => {
    expect(buildLinePath([1, 2], 100, 100, [0, 4])).toBe("M0,75 L100,50");
  });
  it("handles one value and no values", () => {
    expect(buildLinePath([7], 100, 50)).toBe("M0,25");
    expect(buildLinePath([], 100, 50)).toBe("");
  });
});
