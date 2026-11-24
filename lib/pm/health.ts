// Pure program-health logic: milestone status, budget totals, risk severity,
// and the roll-up snapshot the Program view, reports and assistant all read.
// No storage imports, so it runs on the server and in the browser.
import { diffDays } from "./dates";
import type {
  BudgetLine,
  DateString,
  Milestone,
  Project,
  Risk,
  Task,
  Workstream,
} from "./types";

// ---- Schedule

export const MILESTONE_HEALTHS = ["done", "late", "conflict", "slipped", "on_track"] as const;
export type MilestoneHealth = (typeof MILESTONE_HEALTHS)[number];
export const MILESTONE_HEALTH_LABELS: Record<MilestoneHealth, string> = {
  done: "Done",
  late: "Late",
  conflict: "Dependency conflict",
  slipped: "Slipped",
  on_track: "On track",
};

export type MilestoneStatus = Milestone & {
  health: MilestoneHealth;
  /** Days the target has moved past the baseline (negative = pulled in). */
  slipDays: number;
  /** Unfinished dependencies now due after this milestone. */
  blockedBy: { id: string; name: string; targetDate: DateString }[];
};

/**
 * Classifies one milestone. In order: done (completed), late (target date
 * passed), conflict (an unfinished dependency is due after it), slipped
 * (target moved later than baseline), otherwise on track.
 */
export function milestoneStatus(m: Milestone, byId: ReadonlyMap<string, Milestone>, today: DateString): MilestoneStatus {
  const slipDays = diffDays(m.baselineDate, m.targetDate);
  const blockedBy = m.dependsOnIds
    .map((id) => byId.get(id))
    .filter((d): d is Milestone => Boolean(d) && !d!.completedDate && d!.targetDate > m.targetDate)
    .map((d) => ({ id: d.id, name: d.name, targetDate: d.targetDate }));

  let health: MilestoneHealth = "on_track";
  if (m.completedDate) health = "done";
  else if (m.targetDate < today) health = "late";
  else if (blockedBy.length > 0) health = "conflict";
  else if (slipDays > 0) health = "slipped";

  return { ...m, health, slipDays, blockedBy: m.completedDate ? [] : blockedBy };
}

// ---- Budget

export type BudgetTotals = {
  budget: number;
  committed: number;
  spent: number;
  forecast: number;
  /** budget - forecast. Negative means forecast to overrun. */
  variance: number;
};

export function budgetTotals(lines: readonly Pick<BudgetLine, "budget" | "committed" | "spent" | "forecast">[]): BudgetTotals {
  const sum = (key: "budget" | "committed" | "spent" | "forecast") => lines.reduce((n, l) => n + l[key], 0);
  const budget = sum("budget");
  const forecast = sum("forecast");
  return { budget, committed: sum("committed"), spent: sum("spent"), forecast, variance: budget - forecast };
}

// ---- Risks

export type Severity = "low" | "medium" | "high";
export const SEVERITY_LABELS: Record<Severity, string> = { low: "Low", medium: "Medium", high: "High" };

/** 1-9. A risk scores likelihood x impact; an issue has already happened, so it scores as certain. */
export function riskScore(risk: Pick<Risk, "kind" | "likelihood" | "impact">): number {
  return (risk.kind === "issue" ? 3 : risk.likelihood) * risk.impact;
}

export function riskSeverity(risk: Pick<Risk, "kind" | "likelihood" | "impact">): Severity {
  const score = riskScore(risk);
  return score >= 6 ? "high" : score >= 3 ? "medium" : "low";
}

export function isRiskOverdue(risk: Pick<Risk, "status" | "dueDate">, today: DateString): boolean {
  return risk.status !== "closed" && risk.dueDate !== null && risk.dueDate < today;
}

/** Open and either high severity or past its due date. */
export function riskNeedsAttention(risk: Risk, today: DateString): boolean {
  return risk.status !== "closed" && (riskSeverity(risk) === "high" || isRiskOverdue(risk, today));
}

// ---- Roll-up

export type WorkstreamSnapshot = {
  /** null collects milestones and risks not assigned to any workstream. */
  workstream: Workstream | null;
  milestones: MilestoneStatus[];
  budgetLines: BudgetLine[];
  totals: BudgetTotals;
  risks: Risk[];
};

export type OverallStatus = "green" | "amber" | "red";

export type ProgramSnapshot = {
  project: Project;
  today: DateString;
  workstreams: WorkstreamSnapshot[];
  schedule: Record<MilestoneHealth, number> & { total: number };
  budget: BudgetTotals & {
    /** The project's approved total (0 = not set). */
    approved: number;
    /** approved - allocated line budgets; null when no approved total is set. */
    unallocated: number | null;
  };
  risks: { open: number; high: number; overdue: number };
  tasks: { total: number; done: number; overdue: number };
  overall: { status: OverallStatus; reasons: string[] };
};

export function buildSnapshot(input: {
  project: Project;
  workstreams: Workstream[];
  milestones: Milestone[];
  budgetLines: BudgetLine[];
  risks: Risk[];
  tasks: Pick<Task, "status" | "dueDate">[];
  today: DateString;
}): ProgramSnapshot {
  const { project, today } = input;
  const byId = new Map(input.milestones.map((m) => [m.id, m]));
  const statuses = input.milestones.map((m) => milestoneStatus(m, byId, today));
  const known = new Set(input.workstreams.map((w) => w.id));
  const inWs = (id: string | null, wsId: string | null) => (wsId === null ? !id || !known.has(id) : id === wsId);

  const group = (workstream: Workstream | null): WorkstreamSnapshot => {
    const wsId = workstream?.id ?? null;
    const budgetLines = wsId ? input.budgetLines.filter((l) => l.workstreamId === wsId) : [];
    return {
      workstream,
      milestones: statuses.filter((m) => inWs(m.workstreamId, wsId)),
      budgetLines,
      totals: budgetTotals(budgetLines),
      risks: input.risks.filter((r) => inWs(r.workstreamId, wsId)),
    };
  };
  const workstreams = input.workstreams.map(group);
  const unassigned = group(null);
  if (unassigned.milestones.length || unassigned.risks.length) workstreams.push(unassigned);

  const schedule = { total: statuses.length, done: 0, late: 0, conflict: 0, slipped: 0, on_track: 0 };
  for (const m of statuses) schedule[m.health]++;

  const totals = budgetTotals(input.budgetLines);
  const approved = project.budget;
  const openRisks = input.risks.filter((r) => r.status !== "closed");
  const risks = {
    open: openRisks.length,
    high: openRisks.filter((r) => riskSeverity(r) === "high").length,
    overdue: openRisks.filter((r) => isRiskOverdue(r, today)).length,
  };
  const tasks = {
    total: input.tasks.length,
    done: input.tasks.filter((t) => t.status === "done").length,
    overdue: input.tasks.filter((t) => t.status !== "done" && t.dueDate !== null && t.dueDate < today).length,
  };

  // Red: something has already gone wrong. Amber: something is heading that way.
  const red: string[] = [];
  const amber: string[] = [];
  const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
  if (schedule.late) red.push(`${plural(schedule.late, "milestone is", "milestones are")} past the target date`);
  const cap = approved || totals.budget;
  if (cap > 0 && totals.forecast > cap) red.push("forecast cost exceeds the budget");
  const highIssues = openRisks.filter((r) => r.kind === "issue" && riskSeverity(r) === "high").length;
  if (highIssues) red.push(`${plural(highIssues, "high-severity issue is", "high-severity issues are")} open`);
  if (schedule.conflict) amber.push(`${plural(schedule.conflict, "milestone has", "milestones have")} a dependency due after it`);
  if (schedule.slipped) amber.push(`${plural(schedule.slipped, "milestone has", "milestones have")} slipped from baseline`);
  const highRisks = risks.high - highIssues;
  if (highRisks) amber.push(`${plural(highRisks, "high-severity risk is", "high-severity risks are")} open`);
  if (risks.overdue) amber.push(`${plural(risks.overdue, "risk or issue is", "risks or issues are")} past the due date`);

  return {
    project,
    today,
    workstreams,
    schedule,
    budget: { ...totals, approved, unallocated: approved > 0 ? approved - totals.budget : null },
    risks,
    tasks,
    overall: { status: red.length ? "red" : amber.length ? "amber" : "green", reasons: [...red, ...amber] },
  };
}
