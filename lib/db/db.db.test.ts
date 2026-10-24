import { sql } from "drizzle-orm";
import { afterAll, expect, it } from "vitest";

import { closeDb, getDb } from "./index";

afterAll(closeDb);

it("runs a query against Postgres", async () => {
  const result = await getDb().execute(sql`select 1 as ok`);
  expect(result.rows[0]).toEqual({ ok: 1 });
});
