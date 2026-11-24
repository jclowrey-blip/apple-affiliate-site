// Builds a status report in markdown from a program snapshot. Deterministic:
// every figure comes straight from the tracked data, with no AI involved.
import { addDays, formatDate } from "./dates";
import { riskSeverity, type MilestoneStatus, type ProgramSnapshot } from "./health";
import { formatMoney } from "./money";
import { LEVEL_LABELS, RISK_KIND_LABELS, RISK_STATUS_LABELS, type DateString, type Risk } from "./types";

const STATUS_WORD = { green: "Green", amber: "Amber", red: "Red" } as const;
const cell = (text: string) => text.replace(/\|/g, "\\|").replace(/\n/g, " ");
const day = (d: DateString) => formatDate(d, { year: true });

function milestoneLine(m: MilestoneStatus, workstream: string): string {
  const parts = [`**${m.name}** (${workstream})`, `target ${day(m.targetDate)}`];
  if (m.slipDays !== 0) parts.push(`${Math.abs(m.slipDays)} days ${m.slipDays > 0 ? "later" : "earlier"} than baseline ${day(m.baselineDate)}`);
  if (m.blockedBy.length) parts.push(`waiting on ${m.blockedBy.map((b) => `${b.name} (${day(b.targetDate)})`).join(", ")}`);
  return `- ${parts.join("; ")}`;
}

function riskLine(r: Risk, today: DateString): string {
  const bits = [`**${r.title}**`, `${RISK_KIND_LABELS[r.kind]}, ${riskSeverity(r)} severity`, RISK_STATUS_LABELS[r.status].toLowerCase()];
  if (r.owner) bits.push(`owner ${r.owner}`);
  if (r.dueDate) bits.push(`${r.dueDate < today ? "was due" : "due"} ${day(r.dueDate)}`);
  return `- ${bits.join("; ")}${r.mitigation ? `\n  - Mitigation: ${r.mitigation.replace(/\n+/g, " ")}` : ""}`;
}

export function reportTitle(projectName: string, periodEnd: DateString): string {
  return `${projectName} status report, ${day(periodEnd)}`;
}

export function buildStatusReport(snapshot: ProgramSnapshot, period: { start: DateString; end: DateString }): string {
  const { project, today, schedule, budget, risks, tasks, overall } = snapshot;
  const wsName = (m: { workstreamId: string | null }) =>
    snapshot.workstreams.find((w) => w.workstream?.id === m.workstreamId)?.workstream?.name ?? "no workstream";
  const all = snapshot.workstreams.flatMap((w) => w.milestones);
  const allRisks = snapshot.workstreams.flatMap((w) => w.risks);
  const out: string[] = [];

  out.push(`# ${reportTitle(project.name, period.end)}`, "");
  out.push(`Period: ${day(period.start)} to ${day(period.end)}. Figures as of ${day(today)}.`, "");

  out.push("## Overall", "");
  out.push(`**Status: ${STATUS_WORD[overall.status]}.**`);
  if (overall.reasons.length) out.push("", ...overall.reasons.map((r) => `- ${r[0].toUpperCase()}${r.slice(1)}`));
  else out.push("", "No late milestones, no forecast overrun, and no high-severity risks or issues are open.");
  out.push("");

  out.push("## Schedule", "");
  if (schedule.total === 0) {
    out.push("No milestones are being tracked yet.", "");
  } else {
    out.push(
      `${schedule.total} milestones: ${schedule.done} done, ${schedule.on_track} on track, ${schedule.slipped} slipped, ${schedule.conflict} with a dependency conflict, ${schedule.late} late.`,
      "",
    );
    const section = (title: string, list: MilestoneStatus[]) => {
      if (!list.length) return;
      out.push(`### ${title}`, "", ...list.map((m) => milestoneLine(m, wsName(m))), "");
    };
    const completed = all.filter((m) => m.completedDate && m.completedDate >= period.start && m.completedDate <= period.end);
    if (completed.length) {
      out.push("### Completed this period", "", ...completed.map((m) => `- **${m.name}** (${wsName(m)}); completed ${day(m.completedDate!)}`), "");
    }
    section("Late", all.filter((m) => m.health === "late"));
    section("Dependency conflicts", all.filter((m) => m.health === "conflict"));
    section("Slipped from baseline", all.filter((m) => m.health === "slipped"));
    const horizon = addDays(today, 30);
    section("Due in the next 30 days", all.filter((m) => !m.completedDate && m.targetDate >= today && m.targetDate <= horizon));
  }

  out.push("## Budget", "");
  const lines = snapshot.workstreams.filter((w) => w.workstream && w.budgetLines.length);
  if (!lines.length) {
    out.push(budget.approved ? `Approved budget ${formatMoney(budget.approved)}. No budget lines have been entered yet.` : "No budget has been entered yet.", "");
  } else {
    if (budget.approved) {
      out.push(
        `Approved budget ${formatMoney(budget.approved)}; ${formatMoney(budget.budget)} allocated to budget lines${
          budget.unallocated ? ` (${formatMoney(Math.abs(budget.unallocated))} ${budget.unallocated > 0 ? "unallocated" : "over-allocated"})` : ""
        }.`,
        "",
      );
    }
    out.push("| Workstream | Budget | Committed | Spent | Forecast | Variance |", "|---|---:|---:|---:|---:|---:|");
    for (const w of lines) {
      const t = w.totals;
      out.push(`| ${cell(w.workstream!.name)} | ${formatMoney(t.budget)} | ${formatMoney(t.committed)} | ${formatMoney(t.spent)} | ${formatMoney(t.forecast)} | ${formatMoney(t.variance)} |`);
    }
    out.push(`| **Total** | **${formatMoney(budget.budget)}** | **${formatMoney(budget.committed)}** | **${formatMoney(budget.spent)}** | **${formatMoney(budget.forecast)}** | **${formatMoney(budget.variance)}** |`, "");
    out.push("Variance is budget minus forecast; a negative figure is a forecast overrun.", "");
    const over = lines.flatMap((w) => w.budgetLines.filter((l) => l.forecast > l.budget).map((l) => ({ l, ws: w.workstream!.name })));
    if (over.length) {
      out.push("### Lines forecast to overrun", "", ...over.map(({ l, ws }) => `- **${l.name}** (${ws}): forecast ${formatMoney(l.forecast)} against a budget of ${formatMoney(l.budget)}, ${formatMoney(l.forecast - l.budget)} over`), "");
    }
  }

  out.push("## Risks and issues", "");
  const open = allRisks.filter((r) => r.status !== "closed");
  if (!allRisks.length) {
    out.push("Nothing has been logged in the register yet.", "");
  } else {
    out.push(`${risks.open} open: ${risks.high} high severity, ${risks.overdue} past the due date.`, "");
    const high = open.filter((r) => riskSeverity(r) === "high");
    if (high.length) out.push("### High severity", "", ...high.map((r) => riskLine(r, today)), "");
    const overdue = open.filter((r) => r.dueDate && r.dueDate < today && riskSeverity(r) !== "high");
    if (overdue.length) out.push("### Past due", "", ...overdue.map((r) => riskLine(r, today)), "");
    const fresh = allRisks.filter((r) => r.createdAt.slice(0, 10) >= period.start && r.createdAt.slice(0, 10) <= period.end);
    if (fresh.length) {
      out.push("### Raised this period", "", ...fresh.map((r) => `- **${r.title}** (${RISK_KIND_LABELS[r.kind]}; likelihood ${LEVEL_LABELS[r.likelihood].toLowerCase()}, impact ${LEVEL_LABELS[r.impact].toLowerCase()})`), "");
    }
  }

  out.push("## Tasks", "");
  out.push(tasks.total ? `${tasks.done} of ${tasks.total} tasks done; ${tasks.overdue} overdue.` : "No tasks are being tracked yet.", "");

  return out.join("\n").trimEnd() + "\n";
}
