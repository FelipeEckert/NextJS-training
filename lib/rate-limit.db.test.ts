import { randomUUID } from "node:crypto";

import { afterAll, expect, it } from "vitest";

import { closeDb } from "./db";
import { hitRateLimit } from "./rate-limit";

afterAll(closeDb);

const WINDOW_MS = 60_000;

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
