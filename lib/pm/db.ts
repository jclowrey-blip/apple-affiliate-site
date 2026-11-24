// The only place the storage client is created. Everything outside lib/pm/
// goes through the functions in projects.ts, tasks.ts, etc., never this file.
import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { pmPrisma?: PrismaClient };

export const db = globalForPrisma.pmPrisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.pmPrisma = db;
