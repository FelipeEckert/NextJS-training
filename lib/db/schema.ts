import {
  bigint,
  index,
  integer,
  numeric,
  pgTable,
  primaryKey,
  serial,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  passwordHash: text("password_hash"),
  failedLogins: integer("failed_logins").notNull().default(0),
  lockedUntil: timestamp("locked_until", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const wallets = pgTable("wallets", {
  userId: integer("user_id")
    .primaryKey()
    .references(() => users.id),
  cashCents: bigint("cash_cents", { mode: "number" }).notNull(),
  startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
});

export const positions = pgTable(
  "positions",
  {
    userId: integer("user_id")
      .notNull()
      .references(() => users.id),
    pair: text("pair").notNull(),
    quantity: numeric("quantity", { precision: 30, scale: 10 }).notNull(),
    costCents: bigint("cost_cents", { mode: "number" }).notNull(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.pair] })],
);

export const trades = pgTable(
  "trades",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id),
    pair: text("pair").notNull(),
    side: text("side").notNull(),
    quantity: numeric("quantity", { precision: 30, scale: 10 }).notNull(),
    price: numeric("price", { precision: 30, scale: 10 }).notNull(),
    totalCents: bigint("total_cents", { mode: "number" }).notNull(),
    idempotencyKey: text("idempotency_key").notNull(),
    requestHash: text("request_hash").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("trades_user_idempotency_key").on(t.userId, t.idempotencyKey),
    index("trades_user_created_at").on(t.userId, t.createdAt),
  ],
);

export const apiKeys = pgTable("api_keys", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id),
  name: text("name").notNull(),
  prefix: text("prefix").notNull(),
  keyHash: text("key_hash").notNull().unique(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
  revokedAt: timestamp("revoked_at", { withTimezone: true }),
});

export const rateLimits = pgTable(
  "rate_limits",
  {
    bucket: text("bucket").notNull(),
    windowStart: timestamp("window_start", { withTimezone: true }).notNull(),
    count: integer("count").notNull(),
  },
  (t) => [primaryKey({ columns: [t.bucket, t.windowStart] })],
);
