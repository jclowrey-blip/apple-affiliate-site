// Shared class names for /pm controls. Kept out of "use client" modules so
// server components can import the strings too.
import type { TaskStatus } from "@/lib/pm/types";

const btnBase =
  "inline-flex items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed";
export const btnPrimary = `${btnBase} bg-accent text-white hover:bg-accentDark`;
export const btnSecondary = `${btnBase} border border-line bg-white text-ink hover:border-graphite`;
export const btnDanger = `${btnBase} bg-warn text-white hover:opacity-90`;
export const btnGhost = `${btnBase} text-graphite hover:text-ink hover:bg-line/50`;

// 16px text on phones stops iOS from zooming the page when a field is focused.
const fieldBase =
  "rounded-md border border-line bg-white px-3 py-2 text-base sm:text-sm text-ink placeholder:text-graphite/70 focus:outline-none focus:ring-2 focus:ring-accent";
export const fieldClass = `w-full ${fieldBase}`;
/** The same field without a width, for inputs that size to their content (dates). */
export const fieldAutoClass = fieldBase;
export const selectClass =
  "rounded-md border border-line bg-white px-2 py-1.5 text-base sm:text-sm text-ink focus:outline-none focus:ring-2 focus:ring-accent";
export const labelClass = "block text-xs font-medium uppercase tracking-wide text-graphite mb-1";

export const STATUS_DOT: Record<TaskStatus, string> = {
  backlog: "bg-graphite/40",
  todo: "bg-sky-600",
  in_progress: "bg-amber-500",
  done: "bg-accent",
};
