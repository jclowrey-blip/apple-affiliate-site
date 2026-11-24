// Badges for program health. No client hooks, so server components can use them.
import { MILESTONE_HEALTH_LABELS, SEVERITY_LABELS, type MilestoneHealth, type OverallStatus, type Severity } from "@/lib/pm/health";

const pill = "inline-flex items-center gap-1 whitespace-nowrap rounded-full border px-2 py-0.5 text-[11px] font-medium leading-none";

const HEALTH_STYLE: Record<MilestoneHealth, string> = {
  done: "border-accent/40 bg-accent/10 text-accentDark",
  late: "border-warn bg-warn text-white",
  conflict: "border-warn/50 bg-warn/10 text-warn",
  slipped: "border-amber-400 bg-amber-50 text-amber-800",
  on_track: "border-line bg-white text-graphite",
};

export function HealthBadge({ health }: { health: MilestoneHealth }) {
  return <span className={`${pill} ${HEALTH_STYLE[health]}`}>{MILESTONE_HEALTH_LABELS[health]}</span>;
}

const SEVERITY_STYLE: Record<Severity, string> = {
  high: "border-warn bg-warn text-white",
  medium: "border-amber-400 bg-amber-50 text-amber-800",
  low: "border-line bg-white text-graphite",
};

export function SeverityBadge({ severity }: { severity: Severity }) {
  return <span className={`${pill} ${SEVERITY_STYLE[severity]}`}>{SEVERITY_LABELS[severity]}</span>;
}

const OVERALL: Record<OverallStatus, { label: string; style: string }> = {
  green: { label: "Green", style: "border-accent/40 bg-accent/10 text-accentDark" },
  amber: { label: "Amber", style: "border-amber-400 bg-amber-50 text-amber-800" },
  red: { label: "Red", style: "border-warn bg-warn text-white" },
};

export function OverallBadge({ status }: { status: OverallStatus }) {
  return <span className={`${pill} px-2.5 py-1 text-xs ${OVERALL[status].style}`}>{OVERALL[status].label}</span>;
}
