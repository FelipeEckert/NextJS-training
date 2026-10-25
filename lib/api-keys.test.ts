import { describe, expect, it } from "vitest";

import { generateApiKey, hashApiKey, parseBearer } from "./api-keys";

describe("generateApiKey", () => {
  it("makes a ptk_ key whose prefix is its first 12 characters", () => {
    const { key, prefix } = generateApiKey();
    expect(key).toMatch(/^ptk_[A-Za-z0-9_-]{43}$/);
    expect(key).toHaveLength(47);
    expect(prefix).toBe(key.slice(0, 12));
  });

  it("stores the SHA-256 hash of the key, never the key itself", () => {
    const { key, hash } = generateApiKey();
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    expect(hash).toBe(hashApiKey(key));
    expect(hash).not.toContain(key);
  });

  it("makes a different key every time", () => {
    expect(generateApiKey().key).not.toBe(generateApiKey().key);
  });
});

describe("parseBearer", () => {
  it("returns the key after a Bearer scheme", () => {
    expect(parseBearer("Bearer abc")).toBe("abc");
  });

  it("accepts the scheme in any case", () => {
    expect(parseBearer("bearer abc")).toBe("abc");
  });

  it("rejects other schemes, a missing header, and an empty key", () => {
    expect(parseBearer("Basic abc")).toBeNull();
    expect(parseBearer(null)).toBeNull();
    expect(parseBearer("Bearer ")).toBeNull();
  });
});
