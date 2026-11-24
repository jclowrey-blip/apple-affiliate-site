"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { authEnabled } from "./access";
import { SESSION_COOKIE, SESSION_DAYS, createSessionToken, passwordMatches } from "./session";
import type { ActionResult } from "./types";

// Slows down password guessing: after MAX_FAILURES wrong attempts inside the
// window, sign-in is refused until the window passes. Held in memory, which
// is enough for a single-process, single-user tool.
const MAX_FAILURES = 8;
const WINDOW_MS = 10 * 60_000;
const failures: number[] = [];

/** Checks the password and, if right, sets the session cookie and goes to the dashboard. */
export async function loginAction(input: { password: string }): Promise<ActionResult> {
  const password = process.env.PM_PASSWORD;
  if (!password) return { ok: false, error: "Sign-in isn't set up for this tool." };

  const now = Date.now();
  while (failures.length && failures[0] < now - WINDOW_MS) failures.shift();
  if (failures.length >= MAX_FAILURES) return { ok: false, error: "Too many wrong attempts. Wait ten minutes and try again." };

  const candidate = typeof input?.password === "string" ? input.password : "";
  if (!passwordMatches(candidate, password)) {
    failures.push(now);
    await new Promise((resolve) => setTimeout(resolve, 400));
    return { ok: false, error: "That password isn't right." };
  }

  failures.length = 0;
  cookies().set(SESSION_COOKIE, createSessionToken(password), {
    httpOnly: true,
    sameSite: "lax",
    // Only mark the cookie HTTPS-only when the site is actually served over
    // HTTPS, so signing in still works on a plain-HTTP local network address.
    secure: headers().get("x-forwarded-proto") === "https",
    path: "/pm",
    maxAge: SESSION_DAYS * 86_400,
  });
  redirect("/pm");
}

export async function logoutAction(): Promise<void> {
  cookies().delete({ name: SESSION_COOKIE, path: "/pm" });
  redirect(authEnabled() ? "/pm/login" : "/pm");
}
