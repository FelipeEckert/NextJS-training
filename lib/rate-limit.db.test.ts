import { randomUUID } from "node:crypto";

import { afterAll, beforeAll, expect, it, vi } from "vitest";

import { closeDb } from "./db";
import { hitRateLimit } from "./rate-limit";

const WINDOW_MS = 60_000;

// Pin the clock mid-window so a minute boundary cannot split the hits; fake only Date so pg's timers keep working
beforeAll(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-24T12:00:30Z"));
});

afterAll(async () => {
  vi.useRealTimers();
  await closeDb();
});

it("allows hits up to the limit, then denies", async () => {
  const bucket = `test:${randomUUID()}`;

  expect(await hitRateLimit(bucket, 3, WINDOW_MS)).toMatchObject({ allowed: true, remaining: 2 });
  expect(await hitRateLimit(bucket, 3, WINDOW_MS)).toMatchObject({ allowed: true, remaining: 1 });
  expect(await hitRateLimit(bucket, 3, WINDOW_MS)).toMatchObject({ allowed: true, remaining: 0 });
  expect(await hitRateLimit(bucket, 3, WINDOW_MS)).toMatchObject({ allowed: false, remaining: 0 });
});

it("keeps buckets independent", async () => {
  const first = `test:${randomUUID()}`;
  const second = `test:${randomUUID()}`;

  await hitRateLimit(first, 1, WINDOW_MS);
  expect(await hitRateLimit(first, 1, WINDOW_MS)).toMatchObject({ allowed: false });
  expect(await hitRateLimit(second, 1, WINDOW_MS)).toMatchObject({ allowed: true });
});
