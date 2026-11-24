// Date-only helpers. Due dates and milestone targets are "YYYY-MM-DD" strings,
// which compare correctly with plain string comparison and never shift with timezones.

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export function isISODate(value: string): boolean {
  if (!ISO_DATE.test(value)) return false;
  const [y, m, d] = value.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

/** Today's date in the local timezone of the running process. */
export function todayISO(now: Date = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function toUTC(date: string): Date {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

function fromUTC(dt: Date): string {
  return dt.toISOString().slice(0, 10);
}

export function addDays(date: string, days: number): string {
  const dt = toUTC(date);
  dt.setUTCDate(dt.getUTCDate() + days);
  return fromUTC(dt);
}

/** Whole days from `a` to `b` (positive when b is later). */
export function diffDays(a: string, b: string): number {
  return Math.round((toUTC(b).getTime() - toUTC(a).getTime()) / 86_400_000);
}

/** Sunday that ends the Monday–Sunday week containing `date`. */
export function endOfWeek(date: string): string {
  const dow = toUTC(date).getUTCDay(); // 0 = Sunday
  return addDays(date, dow === 0 ? 0 : 7 - dow);
}

export function formatDate(date: string, opts: { year?: boolean } = {}): string {
  return toUTC(date).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: opts.year ? "numeric" : undefined,
    timeZone: "UTC",
  });
}

export function monthLabel(date: string): string {
  return toUTC(date).toLocaleDateString("en-US", { month: "short", year: "numeric", timeZone: "UTC" });
}

/** 0 = Monday … 6 = Sunday. */
export function weekdayIndex(date: string): number {
  return (toUTC(date).getUTCDay() + 6) % 7;
}

/** Monday that starts the week containing `date`. */
export function startOfWeek(date: string): string {
  return addDays(date, -weekdayIndex(date));
}
