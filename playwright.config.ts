import { defineConfig, devices } from "@playwright/test";

// End-to-end tests for /pm. They run against a production build that uses its
// own SQLite file (prisma/e2e.db), re-seeded on every run, so the dev database
// is never touched. Note: this runs `next build`, so stop `npm run dev` first.
const PORT = 3210;
const env = { DATABASE_URL: "file:./e2e.db", PM_ENABLED: "1" };

export default defineConfig({
  testDir: "./e2e",
  // One worker, in file order: the tests share one database.
  workers: 1,
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  reporter: "list",
  timeout: 30_000,
  use: {
    baseURL: `http://localhost:${PORT}`,
    viewport: { width: 1280, height: 900 },
    trace: "off",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 900 } } }],
  webServer: {
    command: `prisma migrate deploy && tsx prisma/seed.ts && next build && next start -p ${PORT}`,
    url: `http://localhost:${PORT}/pm`,
    env,
    timeout: 240_000,
    reuseExistingServer: false,
  },
});
