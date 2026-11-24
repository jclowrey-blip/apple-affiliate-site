// Shared class strings for /pm form controls and buttons, built on the
// storefront's existing Tailwind tokens (ink, paper, graphite, line, accent, warn).
export const inputCls =
  "w-full rounded-md border border-line bg-white px-3 py-2 text-base sm:text-sm text-ink placeholder:text-graphite/60 focus:outline-none focus:ring-2 focus:ring-accent";

export const selectCls =
  "rounded-md border border-line bg-white px-2 py-1.5 text-base sm:text-sm text-ink focus:outline-none focus:ring-2 focus:ring-accent";

export const btnPrimary =
  "inline-flex items-center justify-center gap-2 rounded-md bg-accent px-3.5 py-2 text-sm font-medium text-paper hover:bg-accentDark transition-colors disabled:opacity-50";

export const btnSecondary =
  "inline-flex items-center justify-center gap-2 rounded-md border border-line bg-white px-3.5 py-2 text-sm font-medium text-ink hover:border-graphite transition-colors disabled:opacity-50";

export const btnDanger =
  "inline-flex items-center justify-center gap-2 rounded-md bg-warn px-3.5 py-2 text-sm font-medium text-paper hover:opacity-90 transition-opacity disabled:opacity-50";

export const btnGhost =
  "inline-flex items-center justify-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm text-graphite hover:bg-line/50 hover:text-ink transition-colors";

export const labelCls = "block text-xs font-medium uppercase tracking-wide text-graphite mb-1";

export const kbdCls =
  "hidden sm:inline-block rounded border border-line bg-paper px-1.5 py-0.5 font-mono text-[10px] leading-none text-graphite";
