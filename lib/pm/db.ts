// The only module that talks to Prisma directly, together with the
// data-access files next to it. Nothing outside lib/pm imports this.
import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { pmPrisma?: PrismaClient };

export const prisma = globalForPrisma.pmPrisma ?? new PrismaClient();

// Reuse one client across hot reloads in development.
if (process.env.NODE_ENV !== "production") globalForPrisma.pmPrisma = prisma;
