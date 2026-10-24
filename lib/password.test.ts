import { describe, expect, it } from "vitest";
import { hashPassword, PasswordSchema, UsernameSchema, verifyPassword } from "./password";

describe("hashPassword / verifyPassword", () => {
  it("verifies the right password", async () => {
    const stored = await hashPassword("correct horse");
    expect(await verifyPassword("correct horse", stored)).toBe(true);
  });

  it("rejects a wrong password", async () => {
    const stored = await hashPassword("correct horse");
    expect(await verifyPassword("wrong horse", stored)).toBe(false);
  });

  it("uses a fresh salt, so two hashes of the same password differ", async () => {
    const a = await hashPassword("same password");
    const b = await hashPassword("same password");
    expect(a).not.toBe(b);
  });

  it("returns false for a missing account (null)", async () => {
    expect(await verifyPassword("anything", null)).toBe(false);
  });

  it("returns false for a malformed stored value", async () => {
    expect(await verifyPassword("anything", "abc")).toBe(false);
  });

  it("returns false when the stored hash has the wrong length", async () => {
    expect(await verifyPassword("anything", "scrypt$AAAA$AAAA")).toBe(false);
  });
});

describe("UsernameSchema", () => {
  it("trims and lowercases", () => {
    expect(UsernameSchema.parse(" Ab_c ")).toBe("ab_c");
  });

  it("rejects too short, spaces, and too long", () => {
    expect(UsernameSchema.safeParse("ab").success).toBe(false);
    expect(UsernameSchema.safeParse("a b").success).toBe(false);
    expect(UsernameSchema.safeParse("a".repeat(21)).success).toBe(false);
  });
});

describe("PasswordSchema", () => {
  it("rejects 7 characters and accepts 8", () => {
    expect(PasswordSchema.safeParse("1234567").success).toBe(false);
    expect(PasswordSchema.safeParse("12345678").success).toBe(true);
  });
});
