import { expect, it } from "vitest";

import { safeNextPath } from "./safe-next-path";

it("defaults to the wallet", () => {
  expect(safeNextPath(undefined)).toBe("/wallet");
});

it("keeps a local path and its query", () => {
  expect(safeNextPath("/currency/USD-BRL?x=1")).toBe("/currency/USD-BRL?x=1");
});

it.each(["//evil.com", "https://evil.com", "/.//evil.com", "/..//evil.com", "/a/..//evil.com", "//["])(
  "rejects %s",
  (next) => {
    expect(safeNextPath(next)).toBe("/wallet");
  },
);
