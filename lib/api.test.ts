import { describe, expect, it } from "vitest";

import { apiError } from "./api";

describe("apiError", () => {
  it("returns the status and a JSON error body", async () => {
    const res = apiError(404, "UNKNOWN_PAIR", "Unknown pair.");
    expect(res.status).toBe(404);
    expect(res.headers.get("content-type")).toMatch(/^application\/json/);
    expect(await res.json()).toEqual({ error: { code: "UNKNOWN_PAIR", message: "Unknown pair." } });
  });

  it("keeps extra headers", () => {
    const res = apiError(429, "RATE_LIMITED", "Too many requests.", { "Retry-After": "5" });
    expect(res.headers.get("Retry-After")).toBe("5");
    expect(res.headers.get("content-type")).toMatch(/^application\/json/);
  });
});
