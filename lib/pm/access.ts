// The single access gate for the /pm tool. There is no authentication yet:
// the tool is open in development and switched off in production builds
// unless PM_ENABLED=1.
//
// To add real auth later, replace the body of hasAccess() with a session
// check. Nothing else needs to change:
//   - app/pm/layout.tsx calls hasAccess() and renders no shell or data without it
//   - every /pm page calls requireAccess()
//   - every server action calls hasAccess()
//
// Pages check as well as the layout because Next.js renders a layout and its
// page independently: a check in the layout alone still lets the page fetch
// its data and send it in the response.
import { notFound } from "next/navigation";

export async function hasAccess(): Promise<boolean> {
  if (process.env.NODE_ENV !== "production") return true;
  return process.env.PM_ENABLED === "1";
}

/** For layouts and pages: responds with a 404 when access is not allowed. */
export async function requireAccess(): Promise<void> {
  if (!(await hasAccess())) notFound();
}
