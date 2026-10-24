import { configDefaults, defineConfig } from "vitest/config";
import { loadEnv } from "vite";

import base from "./vitest.config";

// Spread instead of mergeConfig: mergeConfig concatenates arrays, which would keep the base's *.db.test.ts exclude.
export default defineConfig({
  ...base,
  test: {
    ...base.test,
    include: ["**/*.db.test.ts"],
    exclude: configDefaults.exclude,
    env: loadEnv("", process.cwd(), ""),
    fileParallelism: false,
    testTimeout: 20_000,
  },
});
