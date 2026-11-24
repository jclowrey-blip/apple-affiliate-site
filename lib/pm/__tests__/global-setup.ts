import { execSync } from "node:child_process";
import { rmSync } from "node:fs";
import type { TestProject } from "vitest/node";

// Applies the real migrations to the temporary test database, and removes it afterwards.
export default function setup(project: TestProject) {
  const url = project.config.env.DATABASE_URL as string;
  const file = url.replace(/^file:/, "");
  rmSync(file, { force: true });
  execSync("npx prisma migrate deploy", { env: { ...process.env, DATABASE_URL: url }, stdio: "pipe" });
  return () => {
    rmSync(file, { force: true });
    rmSync(`${file}-journal`, { force: true });
  };
}
