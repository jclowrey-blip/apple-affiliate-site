// The single access gate for the /pm tool.
//
// - With PM_PASSWORD set, the tool requires signing in at /pm/login. A signed
//   session cookie (see session.ts) then grants access for 30 days.
// - With no password set, there is no sign-in: the tool is open in
//   development and switched off in production builds unless PM_ENABLED=1.
//
// Who calls this:
//   - app/pm/layout.tsx calls hasAccess() and renders no shell or data without it
//   - every /pm page calls requireAccess()
//   - every server action and the assistant endpoint call hasAccess()
//
// Pages check as well as the layout because Next.js renders a layout and its
// page independently: a check in the layout alone still lets the page fetch
// its data and send it in the response.
import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { SESSION_COOKIE, verifySessionToken } from "./session";

/** True when a password is configured, i.e. the tool has a sign-in. */
export function authEnabled(): boolean {
  return Boolean(process.env.PM_PASSWORD);
}

export async function hasAccess(): Promise<boolean> {
  const password = process.env.PM_PASSWORD;
  if (password) {
    const token = cookies().get(SESSION_COOKIE)?.value;
    return Boolean(token) && verifySessionToken(token!, password);
  }
  if (process.env.NODE_ENV !== "production") return true;
  return process.env.PM_ENABLED === "1";
}

/**
 * For pages: sends the visitor to the sign-in page when one exists, and
 * otherwise responds with a 404.
 */
export async function requireAccess(): Promise<void> {
  if (await hasAccess()) return;
  if (authEnabled()) redirect("/pm/login");
  notFound();
}
