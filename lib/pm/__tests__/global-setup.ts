import { execSync } from "node:child_process";
import { rmSync } from "node:fs";
import path from "node:path";

// Builds a fresh test database from the committed migrations before the run.
export default function setup() {
  const dbFile = path.resolve(__dirname, "../../../prisma/test.db");
  for (const suffix of ["", "-journal"]) rmSync(dbFile + suffix, { force: true });
  execSync("npx prisma migrate deploy", {
    cwd: path.resolve(__dirname, "../../.."),
    env: { ...process.env, DATABASE_URL: "file:./test.db" },
    stdio: "pipe",
  });
  return () => {
    for (const suffix of ["", "-journal"]) rmSync(dbFile + suffix, { force: true });
  };
}
