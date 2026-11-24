import { notFound } from "next/navigation";

/**
 * The single access gate for everything under /pm, called from app/pm/layout.tsx
 * and from every server action.
 *
 * There is no authentication yet: the tool is meant to run locally. So that an
 * unauthenticated, writable tool can never be exposed by accident, production
 * builds return 404 unless PM_ENABLED=1 is set. To add real auth later, replace
 * the body of this function with a session check (redirect or notFound on failure).
 */
export async function requirePmAccess(): Promise<void> {
  if (process.env.NODE_ENV === "production" && process.env.PM_ENABLED !== "1") {
    notFound();
  }
}
