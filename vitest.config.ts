import { tmpdir } from "node:os";
import { join } from "node:path";
import { defineConfig } from "vitest/config";

// Data-layer tests run against a throwaway SQLite file, never the dev database.
const testDb = join(tmpdir(), `pm-test-${process.pid}.db`);

export default defineConfig({
  resolve: { alias: { "@": __dirname } },
  test: {
    include: ["lib/**/*.test.ts"],
    globalSetup: ["lib/pm/__tests__/global-setup.ts"],
    env: { DATABASE_URL: `file:${testDb}` },
    fileParallelism: false,
  },
});
