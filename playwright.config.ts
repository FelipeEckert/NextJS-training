import { defineConfig } from "@playwright/test";

// With E2E_BASE_URL set (a dev server you already run), nothing is started here.
// Without it, the config starts the fake AwesomeAPI and its own `next dev` on port 3100.
const baseURL = process.env.E2E_BASE_URL ?? "http://127.0.0.1:3100";

export default defineConfig({
  testDir: "e2e",
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  timeout: 120_000, // the first `next dev` compiles of each page are slow
  expect: { timeout: 30_000 },
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL,
    trace: "retain-on-failure",
  },
  projects: [{ name: "chromium", use: { browserName: "chromium" } }],
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : [
        {
          command: "node scripts/fake-awesomeapi.mjs",
          port: 3999,
          reuseExistingServer: false,
        },
        {
          command: "npx next dev -p 3100",
          url: "http://127.0.0.1:3100/login",
          timeout: 180_000,
          reuseExistingServer: false,
          env: { AWESOMEAPI_BASE_URL: "http://127.0.0.1:3999" }, // merged over process.env
        },
      ],
});
