// Deterministic stand-in for the AwesomeAPI, shared by the smoke test and the Playwright e2e run.
// Run directly (`node scripts/fake-awesomeapi.mjs`) it listens on 3999 until killed.
import { createServer } from "node:http";
import { pathToFileURL } from "node:url";

const DAY_MS = 86_400_000;

export function startFakeApi(port = 3999) {
  const server = createServer((req, res) => {
    const [root, kind, arg] = new URL(req.url, `http://127.0.0.1:${port}`).pathname
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
  return new Promise((resolve) => server.listen(port, "127.0.0.1", () => resolve(server)));
}

export function closeServer(server) {
  server.closeAllConnections();
  return new Promise((resolve) => server.close(() => resolve()));
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  await startFakeApi();
  console.log("fake AwesomeAPI listening on http://127.0.0.1:3999");
}
