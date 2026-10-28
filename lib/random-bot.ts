import { createHash } from "node:crypto";

import type { BotAction } from "./house-bot";

export const RANDOM_BOT_USERNAME = "random_bot";

// Same seed, same answer: a cron retry on the same day repeats the same decision (and the idempotency key replays the order)
export function coinFlip(seed: string): boolean {
  return createHash("sha256").update(seed).digest()[0] >= 128;
}

export function decideRandom(input: { holding: boolean; pair: string; now: Date }): BotAction {
  const seed = `${input.now.toISOString().slice(0, 10)}-${input.pair}`;
  if (!coinFlip(seed)) return "hold";
  return input.holding ? "sell" : "buy";
}
