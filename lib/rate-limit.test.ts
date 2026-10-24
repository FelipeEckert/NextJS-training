import { describe, expect, it } from "vitest";

import { retryAfterSeconds, windowStart } from "./rate-limit";

describe("windowStart", () => {
  it("floors the time to the start of its window", () => {
    expect(windowStart(125_000, 60_000)).toBe(120_000);
  });
});

describe("retryAfterSeconds", () => {
  it("counts the seconds until the window ends", () => {
    expect(retryAfterSeconds(125_000, 60_000)).toBe(55);
  });

  it("is never less than 1 second", () => {
    expect(retryAfterSeconds(179_999, 60_000)).toBe(1);
  });
});
