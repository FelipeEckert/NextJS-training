import { describe, expect, it } from "vitest";
import { signToken, verifyToken } from "./session-token";

const SECRET = "x".repeat(32);
const USER = { id: 7, username: "felipe_1" };
const LATER = 2_000_000_000_000;
const NOW = 1_000_000_000_000;

describe("signToken / verifyToken", () => {
  it("round-trips a signed user", () => {
    const token = signToken(USER, LATER, SECRET);
    expect(verifyToken(token, SECRET, NOW)).toEqual(USER);
  });

  it("rejects a token whose username was changed", () => {
    const [id, , expiresAt, signature] = signToken(USER, LATER, SECRET).split(".");
    expect(verifyToken(`${id}.admin.${expiresAt}.${signature}`, SECRET, NOW)).toBeNull();
  });

  it("rejects a token signed with another secret", () => {
    const token = signToken(USER, LATER, "y".repeat(32));
    expect(verifyToken(token, SECRET, NOW)).toBeNull();
  });

  it("rejects an expired token", () => {
    const token = signToken(USER, NOW - 1, SECRET);
    expect(verifyToken(token, SECRET, NOW)).toBeNull();
  });

  it("rejects the old three-part token format", () => {
    expect(verifyToken("demo.9999999999999.abc", SECRET, NOW)).toBeNull();
  });

  it("rejects a missing token", () => {
    expect(verifyToken(undefined, SECRET, NOW)).toBeNull();
  });

  it("rejects a non-numeric user id", () => {
    const [, username, expiresAt, signature] = signToken(USER, LATER, SECRET).split(".");
    expect(verifyToken(`abc.${username}.${expiresAt}.${signature}`, SECRET, NOW)).toBeNull();
  });
});
