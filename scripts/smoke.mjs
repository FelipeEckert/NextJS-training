// CI smoke test: runs the real app under `next dev` (which performs Next's runtime checks)
// against seeded Postgres data and a fake AwesomeAPI, then requests the key pages.
import { spawn, spawnSync } from "node:child_process";
import { createHmac } from "node:crypto";
import { existsSync, readFileSync, rmSync } from "node:fs";
import { createServer } from "node:http";
import { createServer as createNetServer } from "node:net";

import pg from "pg";

const { Client } = pg;

const API_PORT = 3999;
const APP_PORT = 3100;
const APP = `http://127.0.0.1:${APP_PORT}`;
const USERNAME = "smoke_trader";
const LOG_FILE = ".next/dev/logs/next-development.log";
const DAY_MS = 86_400_000;
const TIMEOUT_MS = 120_000;

const { DATABASE_URL, SESSION_SECRET } = process.env;
if (!DATABASE_URL || !SESSION_SECRET) {
  console.error("DATABASE_URL and SESSION_SECRET must be set");
  process.exit(1);
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Same format and signature as lib/session-token.ts
function mintSessionCookie(userId) {
  const payload = `${userId}.${USERNAME}.${Date.now() + 60 * 60 * 1000}`;
  return `${payload}.${createHmac("sha256", SESSION_SECRET).update(payload).digest("base64url")}`;
}

function startFakeApi() {
  const server = createServer((req, res) => {
    const [root, kind, arg] = new URL(req.url, `http://127.0.0.1:${API_PORT}`).pathname
      .split("/")
      .filter(Boolean);
    res.setHeader("content-type", "application/json");

    if (root === "json" && kind === "last" && arg) {
      const body = {};
      for (const pair of arg.split(",")) {
        body[pair.replace("-", "")] = {
          bid: "5.0000",
          ask: "5.0100",
          pctChange: "0.50",
          create_date: "2026-10-24 12:00:00",
        };
      }
      res.end(JSON.stringify(body));
    } else if (root === "json" && kind === "daily" && arg) {
      const now = new Date();
      const todayNoon = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 12);
      const points = Array.from({ length: 30 }, (_, i) => ({
        bid: i % 2 === 0 ? "5.0000" : "5.1000",
        timestamp: String(Math.floor((todayNoon - i * DAY_MS) / 1000)), // newest first
      }));
      res.end(JSON.stringify(points));
    } else {
      res.statusCode = 404;
      res.end("{}");
    }
  });
  return new Promise((resolve) => server.listen(API_PORT, "127.0.0.1", () => resolve(server)));
}

function closeServer(server) {
  server.closeAllConnections();
  return new Promise((resolve) => server.close(() => resolve()));
}

// Idempotent: fixed username and conflict-safe inserts, so reruns reuse the same rows
async function seed(client) {
  await client.query("insert into users (username) values ($1) on conflict (username) do nothing", [
    USERNAME,
  ]);
  const {
    rows: [user],
  } = await client.query("select id from users where username = $1", [USERNAME]);
  await client.query(
    `insert into wallets (user_id, cash_cents, started_at)
     values ($1, 9950000, now() - interval '5 days') on conflict (user_id) do nothing`,
    [user.id],
  );
  await client.query(
    `insert into positions (user_id, pair, quantity, cost_cents)
     values ($1, 'USD-BRL', 10, 50000) on conflict (user_id, pair) do nothing`,
    [user.id],
  );
  await client.query(
    `insert into trades (user_id, pair, side, quantity, price, total_cents, idempotency_key, request_hash, created_at)
     values ($1, 'USD-BRL', 'buy', 10, 5, 50000, 'smoke-seed-1', 'seed', now() - interval '3 days')
     on conflict (user_id, idempotency_key) do nothing`,
    [user.id],
  );
  return user.id;
}

// Fails if something already listens on the app port, so we never test someone else's server
function assertPortFree(port) {
  return new Promise((resolve, reject) => {
    const probe = createNetServer();
    probe.once("error", () => reject(new Error(`port ${port} is already in use`)));
    probe.listen(port, () => probe.close(() => resolve()));
  });
}

function startDevServer() {
  rmSync(LOG_FILE, { force: true }); // entries from an earlier run must not fail this one
  const child = spawn(`npx next dev -p ${APP_PORT}`, {
    shell: true,
    detached: process.platform !== "win32", // own process group, so we can kill the whole tree
    env: { ...process.env, AWESOMEAPI_BASE_URL: `http://127.0.0.1:${API_PORT}` },
    stdio: ["ignore", "pipe", "pipe"],
  });
  let output = "";
  let exit = null; // why the dev server stopped early, if it did
  child.stdout.setEncoding("utf8");
  child.stderr.setEncoding("utf8");
  child.stdout.on("data", (chunk) => (output += chunk));
  child.stderr.on("data", (chunk) => (output += chunk));
  child.on("exit", (code, signal) => {
    exit ??= code !== null ? `exit code ${code}` : `signal ${signal}`;
  });
  child.on("error", (error) => {
    exit ??= error.message;
  });
  return { child, getOutput: () => output, getExit: () => exit };
}

function stopDevServer(child) {
  if (process.platform === "win32") {
    spawnSync("taskkill", ["/pid", String(child.pid), "/T", "/F"]);
    return;
  }
  try {
    process.kill(-child.pid, "SIGTERM");
  } catch {
    // already exited
  }
}

async function waitForApp(dev) {
  const deadline = Date.now() + TIMEOUT_MS;
  while (Date.now() < deadline) {
    const exit = dev.getExit();
    if (exit) {
      const tail = dev.getOutput().split("\n").slice(-20).join("\n");
      throw new Error(`next dev stopped before ${APP}/login answered (${exit}). Last output:\n${tail}`);
    }
    try {
      const res = await fetch(`${APP}/login`, { signal: AbortSignal.timeout(TIMEOUT_MS) });
      await res.text();
      if (res.status === 200) return;
    } catch {
      // not listening yet
    }
    await sleep(1000);
  }
  throw new Error(`dev server did not answer ${APP}/login with 200 within 120 s`);
}

const CHECKS = [
  { path: "/", cookie: false, status: 200, contains: ["Exchange Rates"] },
  { path: "/currency/USD-BRL", cookie: false, status: 200, contains: ["Sign in to trade"] },
  { path: "/currency/USD-BRL", cookie: true, status: 200, contains: ["You hold"] },
  { path: "/login", cookie: false, status: 200, contains: ["Try the demo"] },
  { path: "/signup", cookie: false, status: 200, contains: ["Create account"] },
  { path: "/wallet", cookie: false, status: 307 },
  {
    path: "/wallet",
    cookie: true,
    status: 200,
    contains: ["Total value", "USD"],
    notContains: ["Price unavailable"],
  },
  {
    path: "/leaderboard",
    cookie: false,
    status: 200,
    contains: [USERNAME],
    notContains: ["temporarily unavailable"],
  },
  {
    path: "/backtest?pair=USD-BRL&kind=dip",
    cookie: false,
    status: 200,
    contains: ["Buy and hold", "Max drawdown"],
    notContains: ["History unavailable"],
  },
];

async function runChecks(sessionToken) {
  const results = [];
  for (const check of CHECKS) {
    const label = `${check.path} (${check.cookie ? "logged in" : "logged out"})`;
    try {
      const res = await fetch(APP + check.path, {
        redirect: "manual",
        signal: AbortSignal.timeout(TIMEOUT_MS),
        headers: check.cookie ? { Cookie: `session=${sessionToken}` } : {},
      });
      const body = await res.text();
      const problems = [];
      if (res.status !== check.status) problems.push(`status ${res.status}, expected ${check.status}`);
      for (const text of check.contains ?? []) {
        if (!body.includes(text)) problems.push(`missing "${text}"`);
      }
      for (const text of check.notContains ?? []) {
        if (body.includes(text)) problems.push(`contains "${text}"`);
      }
      results.push({ ok: problems.length === 0, label, reason: problems.join("; ") });
    } catch (error) {
      results.push({ ok: false, label, reason: error.message });
    }
  }
  return results;
}

function collectServerErrors(output) {
  const errors = output
    .split("\n")
    .filter((line) => line.includes("⨯") || line.includes("Error:"));
  if (existsSync(LOG_FILE)) {
    for (const line of readFileSync(LOG_FILE, "utf8").split("\n")) {
      try {
        if (JSON.parse(line).level === "ERROR") errors.push(line);
      } catch {
        // not a JSON log line
      }
    }
  }
  return errors.filter((line) => !line.includes("Warning:")); // Node deprecation and SSL warnings
}

async function main() {
  const client = new Client({ connectionString: DATABASE_URL });
  await client.connect();
  const api = await startFakeApi();
  let dev;
  let results = [];
  let errors = [];
  try {
    const userId = await seed(client);
    await assertPortFree(APP_PORT);
    dev = startDevServer();
    await waitForApp(dev);
    results = await runChecks(mintSessionCookie(userId));
    await sleep(3000); // let the dev server log anything it raised after the last response
    errors = collectServerErrors(dev.getOutput());
  } finally {
    if (dev) stopDevServer(dev.child);
    await closeServer(api);
    await client.end();
  }

  for (const r of results) {
    console.log(r.ok ? `PASS ${r.label}` : `FAIL ${r.label} ${r.reason}`);
  }
  if (errors.length > 0) {
    console.log("Server errors:");
    for (const line of errors) console.log(line);
  }

  const failed = results.some((r) => !r.ok) || errors.length > 0;
  process.exit(failed ? 1 : 0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
