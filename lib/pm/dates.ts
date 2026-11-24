// Date-only helpers. Due dates and milestone dates are calendar days
// (YYYY-MM-DD strings) and are stored at UTC midnight; all arithmetic here is
// done in UTC so it never shifts a day across timezones.
import type { DateString } from "./types";

export function toDateString(date: Date): DateString {
  return date.toISOString().slice(0, 10);
}

export function fromDateString(value: DateString): Date {
  return new Date(`${value}T00:00:00.000Z`);
}

/** Today's calendar date in the machine's local timezone. */
export function todayString(now: Date = new Date()): DateString {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** The local calendar date of a timestamp (ISO string or Date). */
export function localDateOf(at: string | Date): DateString {
  return todayString(typeof at === "string" ? new Date(at) : at);
}

export function addDays(value: DateString, days: number): DateString {
  const date = fromDateString(value);
  date.setUTCDate(date.getUTCDate() + days);
  return toDateString(date);
}

/** Whole days from a to b (positive when b is later). */
export function diffDays(a: DateString, b: DateString): number {
  return Math.round((fromDateString(b).getTime() - fromDateString(a).getTime()) / 86_400_000);
}

/** The Sunday that ends the Monday–Sunday week containing the given date. */
export function endOfWeek(value: DateString): DateString {
  const weekday = fromDateString(value).getUTCDay(); // 0 = Sunday
  return addDays(value, weekday === 0 ? 0 : 7 - weekday);
}

export function formatDate(value: DateString, opts: { year?: boolean } = {}): string {
  return fromDateString(value).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: opts.year ? "numeric" : undefined,
    timeZone: "UTC",
  });
}
