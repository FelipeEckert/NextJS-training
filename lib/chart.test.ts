import { describe, expect, it } from "vitest";
import { buildAreaPath, buildLinePath, nearestIndex, scaleY } from "./chart";

describe("scaleY", () => {
  it("maps the domain's min to the bottom and max to the top", () => {
    expect(scaleY(1, 50, [1, 3])).toBe(50);
    expect(scaleY(3, 50, [1, 3])).toBe(0);
    expect(scaleY(2, 50, [1, 3])).toBe(25);
  });
  it("puts a flat domain in the middle", () => {
    expect(scaleY(5, 50, [5, 5])).toBe(25);
  });
});

describe("nearestIndex", () => {
  it("picks the index whose x is closest", () => {
    expect(nearestIndex(0, 100, 5)).toBe(0);
    expect(nearestIndex(100, 100, 5)).toBe(4);
    expect(nearestIndex(49, 100, 5)).toBe(2);
    expect(nearestIndex(51, 100, 5)).toBe(2);
  });
  it("clamps x positions outside the box", () => {
    expect(nearestIndex(-20, 100, 5)).toBe(0);
    expect(nearestIndex(150, 100, 5)).toBe(4);
  });
  it("returns 0 for a single point or a zero-width box", () => {
    expect(nearestIndex(80, 100, 1)).toBe(0);
    expect(nearestIndex(80, 0, 5)).toBe(0);
  });
});

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

describe("buildAreaPath", () => {
  it("closes the line down to the bottom edge", () => {
    const area = buildAreaPath([1, 2, 3], 100, 50);
    expect(area.startsWith(buildLinePath([1, 2, 3], 100, 50))).toBe(true);
    expect(area.endsWith("L100,50 L0,50 Z")).toBe(true);
  });
  it("has no width for a single value, so it closes at the left edge", () => {
    expect(buildAreaPath([7], 100, 50)).toBe("M0,25 L0,50 L0,50 Z");
  });
  it("is empty for no values", () => {
    expect(buildAreaPath([], 100, 50)).toBe("");
  });
});
