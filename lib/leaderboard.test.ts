import { describe, expect, it } from "vitest";
import { rankWallets } from "./leaderboard";
import { parseDecimal, QTY_SCALE, returnPct } from "./money";

const ONE_UNIT = parseDecimal("1", QTY_SCALE)!;
const SIX = parseDecimal("6", QTY_SCALE)!;

function wallet(username: string, cashCents: number, positions: { pair: string; quantity: bigint; costCents: number }[] = []) {
  return { username, cashCents, positions };
}

describe("rankWallets", () => {
  it("orders wallets by return percentage, highest first", () => {
    const ranked = rankWallets(
      [
        wallet("alice", 10_000_000),
        wallet("bob", 11_000_000),
        wallet("carol", 9_000_000),
      ],
      new Map(),
    );

    expect(ranked).toEqual([
      { username: "bob", totalCents: 11_000_000, returnPct: 10 },
      { username: "alice", totalCents: 10_000_000, returnPct: 0 },
      { username: "carol", totalCents: 9_000_000, returnPct: -10 },
    ]);
  });

  it("keeps only the top 10 wallets", () => {
    const wallets = Array.from({ length: 12 }, (_, i) =>
      wallet(`user${String(i).padStart(2, "0")}`, 10_000_000 + i * 100_000),
    );

    const ranked = rankWallets(wallets, new Map())!;

    expect(ranked).toHaveLength(10);
    expect(ranked[0].username).toBe("user11");
    expect(ranked.map((row) => row.username)).not.toContain("user01");
  });

  it("breaks return ties by username, ascending", () => {
    const ranked = rankWallets(
      [wallet("zed", 10_500_000), wallet("bo", 10_500_000), wallet("amy", 10_500_000)],
      new Map(),
    );

    expect(ranked!.map((row) => row.username)).toEqual(["amy", "bo", "zed"]);
  });

  it("returns null when a held position has no bid", () => {
    const ranked = rankWallets(
      [
        wallet("alice", 10_000_000),
        wallet("bob", 4_000_000, [{ pair: "USD-BRL", quantity: ONE_UNIT, costCents: 600 }]),
      ],
      new Map(),
    );

    expect(ranked).toBeNull();
  });

  it("values positions at their bid", () => {
    const ranked = rankWallets(
      [wallet("bob", 4_000_000, [{ pair: "USD-BRL", quantity: ONE_UNIT, costCents: 600 }])],
      new Map([["USD-BRL", SIX]]),
    );

    expect(ranked).toEqual([{ username: "bob", totalCents: 4_000_600, returnPct: returnPct(4_000_600) }]);
  });
});
