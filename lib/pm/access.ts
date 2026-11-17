// The single access gate for the /pm tool. app/pm/layout.tsx and every server
// action call hasAccess(). There is no authentication yet: the tool is open
// in development and switched off in production builds unless PM_ENABLED=1.
//
// To add real auth later, replace the body of hasAccess() with a session
// check (it may become async; both call sites already sit in async code).
export function hasAccess(): boolean {
  if (process.env.NODE_ENV !== "production") return true;
  return process.env.PM_ENABLED === "1";
}
