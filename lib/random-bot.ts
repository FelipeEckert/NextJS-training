import type { BotAction } from "./house-bot";

export const RANDOM_BOT_USERNAME = "random_bot";

// Same seed, same answer: a cron retry on the same day repeats the same decision (and the idempotency key replays the order)
export function coinFlip(seed: string): boolean {
  let hash = 0x811c9dc5;
  for (let i = 0; i < seed.length; i++) {
    hash ^= seed.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return (hash & 1) === 1;
}

export function decideRandom(input: { holding: boolean; pair: string; now: Date }): BotAction {
  const seed = `${input.now.toISOString().slice(0, 10)}-${input.pair}`;
  if (!coinFlip(seed)) return "hold";
  return input.holding ? "sell" : "buy";
}
