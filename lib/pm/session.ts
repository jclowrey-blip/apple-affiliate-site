// Session tokens for the single-password sign-in. Pure functions over
// node:crypto so they can be unit-tested; the cookie handling lives in
// access.ts and auth-actions.ts.
//
// A token is "<expiry ms>.<HMAC of the expiry>", keyed by a secret derived
// from the password. Changing the password therefore signs everyone out.
import { createHash, createHmac, timingSafeEqual } from "node:crypto";

export const SESSION_COOKIE = "pm_session";
export const SESSION_DAYS = 30;

const secretFor = (password: string) => createHash("sha256").update(`pm-session-v1:${password}`).digest();
const sign = (expires: string, password: string) => createHmac("sha256", secretFor(password)).update(expires).digest("hex");

function safeEqual(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

export function createSessionToken(password: string, now: number = Date.now()): string {
  const expires = String(now + SESSION_DAYS * 86_400_000);
  return `${expires}.${sign(expires, password)}`;
}

export function verifySessionToken(token: string, password: string, now: number = Date.now()): boolean {
  const [expires, signature, ...rest] = token.split(".");
  if (!expires || !signature || rest.length > 0 || !/^\d+$/.test(expires)) return false;
  if (!safeEqual(signature, sign(expires, password))) return false;
  return Number(expires) > now;
}

/** Constant-time password comparison (compares digests, so length doesn't leak). */
export function passwordMatches(candidate: string, password: string): boolean {
  const digest = (v: string) => createHash("sha256").update(v).digest();
  return timingSafeEqual(digest(candidate), digest(password));
}
