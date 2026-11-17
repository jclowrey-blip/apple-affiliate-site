import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["lib/pm/__tests__/**/*.test.ts"],
    globalSetup: "./lib/pm/__tests__/global-setup.ts",
    // Data-layer tests share one throwaway SQLite file (prisma/test.db).
    env: { DATABASE_URL: "file:./test.db" },
    fileParallelism: false,
  },
});
