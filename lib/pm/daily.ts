// The daily loop, as pure functions: which questions to ask today, the
// end-of-day summary, and the update requests to send the team. Everything
// is computed from tracked data; no AI is involved here.
import { addDays, diffDays, formatDate, localDateOf } from "./dates";
import type { ScheduleAnalysis } from "./critical-path";
import { isRiskOverdue, riskSeverity, type MilestoneStatus, type ProgramSnapshot } from "./health";
import { formatMoney } from "./money";
import { formatIndex, type Performance } from "./performance";
import { RISK_KIND_LABELS, type Activity, type BudgetLine, type DateString, type Risk, type TeamMember, type Workstream } from "./types";
import type { CommunicationDraft } from "./communications";

const day = (d: DateString) => formatDate(d, { year: true });
const STATUS_WORD = { green: "Green", amber: "Amber", red: "Red" } as const;

// ---------------------------------------------------------------- questions

export type MilestoneQuestion = { milestone: MilestoneStatus; workstream: string; reasons: string[] };
export type RiskQuestion = { risk: Risk; workstream: string; reasons: string[] };

export type DailyCheckin = {
  /** Unfinished milestones that are late, due within 14 days, or on the critical path within 45 days. */
  milestones: MilestoneQuestion[];
  /** Every workstream: progress to confirm. */
  workstreams: Workstream[];
  /** Budget lines with money moving (committed or spent) or forecast over budget. */
  budgetLines: { line: BudgetLine; workstream: string }[];
  /** Open risks and issues that are overdue, due within 7 days, or high severity. */
  risks: RiskQuestion[];
  /** Total number of things being asked about. */
  count: number;
};

export function buildDailyCheckin(snapshot: ProgramSnapshot, analysis: ScheduleAnalysis, today: DateString): DailyCheckin {
  const critical = new Set(analysis.nodes.filter((n) => n.critical).map((n) => n.id));
  const soon = addDays(today, 14);
  const criticalHorizon = addDays(today, 45);

  const milestones: MilestoneQuestion[] = [];
  const risks: RiskQuestion[] = [];
  const budgetLines: DailyCheckin["budgetLines"] = [];
  const workstreams: Workstream[] = [];

  for (const group of snapshot.workstreams) {
    const name = group.workstream?.name ?? "No workstream";
    if (group.workstream) workstreams.push(group.workstream);

    for (const m of group.milestones) {
      if (m.completedDate) continue;
      const reasons: string[] = [];
      if (m.targetDate < today) reasons.push(`${diffDays(m.targetDate, today)} days past its target`);
      else if (m.targetDate <= soon) reasons.push(m.targetDate === today ? "due today" : `due in ${diffDays(today, m.targetDate)} days`);
      if (critical.has(m.id) && m.targetDate <= criticalHorizon) reasons.push("on the critical path");
      if (m.blockedBy.length) reasons.push(`waiting on ${m.blockedBy.map((b) => b.name).join(", ")}`);
      if (reasons.length) milestones.push({ milestone: m, workstream: name, reasons });
    }

    for (const line of group.budgetLines) {
      if (line.committed > 0 || line.spent > 0 || line.forecast > line.budget) budgetLines.push({ line, workstream: name });
    }

    for (const r of group.risks) {
      if (r.status === "closed") continue;
      const reasons: string[] = [];
      if (isRiskOverdue(r, today)) reasons.push(`action was due ${day(r.dueDate!)}`);
      else if (r.dueDate && r.dueDate <= addDays(today, 7)) reasons.push(`action due ${day(r.dueDate)}`);
      if (riskSeverity(r) === "high") reasons.push("high severity");
      if (reasons.length) risks.push({ risk: r, workstream: name, reasons });
    }
  }

  milestones.sort((a, b) => a.milestone.targetDate.localeCompare(b.milestone.targetDate));
  return { milestones, workstreams, budgetLines, risks, count: milestones.length + workstreams.length + budgetLines.length + risks.length };
}

// ------------------------------------------------------------------ summary

export function dailySummaryTitle(projectName: string, today: DateString): string {
  return `${projectName} daily summary, ${day(today)}`;
}

/** Activity entries whose local calendar date is `today`. */
export function activityOn(activities: readonly Activity[], today: DateString): Activity[] {
  return activities.filter((a) => localDateOf(a.at) === today);
}

export function buildDailySummary(input: {
  snapshot: ProgramSnapshot;
  analysis: ScheduleAnalysis;
  performance: Performance;
  /** Today's activity (changes and notes). */
  activities: readonly Activity[];
  today: DateString;
}): string {
  const { snapshot, analysis, performance, activities, today } = input;
  const { project, overall, schedule, budget, risks } = snapshot;
  const all = snapshot.workstreams.flatMap((w) => w.milestones);
  const wsOf = (id: string | null) => snapshot.workstreams.find((w) => w.workstream?.id === id)?.workstream?.name ?? "no workstream";
  const out: string[] = [];

  out.push(`# ${dailySummaryTitle(project.name, today)}`, "");
  out.push(`**Overall: ${STATUS_WORD[overall.status]}.**${overall.reasons.length ? ` ${overall.reasons.map((r) => r[0].toUpperCase() + r.slice(1)).join(". ")}.` : " Nothing late, over forecast or high severity."}`, "");

  const changes = activities.filter((a) => a.kind === "change");
  const notes = activities.filter((a) => a.kind === "note");
  out.push("## What changed today", "");
  out.push(...(changes.length ? changes.map((a) => `- ${a.summary}`) : ["No changes were recorded today."]), "");
  if (notes.length) out.push("## Notes", "", ...notes.map((a) => `- ${a.summary.replace(/\n+/g, " ")}`), "");

  out.push("## Schedule", "");
  if (schedule.total === 0) {
    out.push("No milestones are being tracked yet.", "");
  } else {
    out.push(`${schedule.done} of ${schedule.total} milestones done; ${schedule.late} late, ${schedule.slipped} slipped, ${schedule.conflict} with a dependency conflict.`);
    if (analysis.baselineFinish && analysis.forecastFinish) {
      const slip = analysis.finishSlipDays;
      out.push(
        `Projected finish ${day(analysis.forecastFinish)} against a baseline of ${day(analysis.baselineFinish)}${
          slip === 0 ? " (on baseline)" : ` (${Math.abs(slip)} days ${slip > 0 ? "later" : "earlier"})`
        }.`,
      );
    }
    const m = performance.milestones;
    if (m.plannedByNow > 0) out.push(`Of ${m.plannedByNow} milestones the baseline had finished by now, ${m.plannedDone} are done.`);
    out.push("");
    if (analysis.criticalPath.length) {
      const path = analysis.criticalPath.map((id) => analysis.nodes.find((n) => n.id === id)!);
      out.push("**Critical path:** " + path.map((n) => `${n.name} (${day(n.forecastDate)})`).join(" → "), "");
    } else if (!analysis.hasDependencies && schedule.total > 0) {
      out.push("No dependencies are set between milestones, so there is no critical path to report.", "");
    }
    const late = all.filter((x) => x.health === "late");
    if (late.length) out.push("**Late:**", ...late.map((x) => `- ${x.name} (${wsOf(x.workstreamId)}), target was ${day(x.targetDate)}`), "");
    const next = all.filter((x) => !x.completedDate && x.targetDate >= today && x.targetDate <= addDays(today, 7));
    if (next.length) out.push("**Due in the next 7 days:**", ...next.map((x) => `- ${x.name} (${wsOf(x.workstreamId)}), ${day(x.targetDate)}`), "");
  }

  out.push("## Cost", "");
  if (budget.budget === 0 && budget.approved === 0) {
    out.push("No budget has been entered yet.", "");
  } else {
    const cap = budget.approved || budget.budget;
    out.push(
      `Forecast ${formatMoney(budget.forecast)} against a budget of ${formatMoney(cap)}: ${
        budget.forecast > cap ? `${formatMoney(budget.forecast - cap)} over` : `${formatMoney(cap - budget.forecast)} under`
      }. Spent ${formatMoney(budget.spent)}, committed ${formatMoney(budget.committed)}.`,
    );
    const t = performance.total;
    if (t.ev > 0 || t.ac > 0) {
      out.push(
        `Earned value ${formatMoney(t.ev)} (${t.percentComplete}% complete) against ${formatMoney(t.ac)} spent: CPI ${formatIndex(t.cpi)}${
          t.pv !== null ? `, SPI ${formatIndex(t.spi)} against planned value ${formatMoney(t.pv)}` : ""
        }.`,
      );
    }
    out.push("");
    const over = snapshot.workstreams.flatMap((w) => w.budgetLines.filter((l) => l.forecast > l.budget).map((l) => `- ${l.name} (${w.workstream?.name}): ${formatMoney(l.forecast - l.budget)} over`));
    if (over.length) out.push("**Lines forecast over budget:**", ...over, "");
  }

  out.push("## Risks and issues", "");
  const open = snapshot.workstreams.flatMap((w) => w.risks).filter((r) => r.status !== "closed");
  if (!open.length) {
    out.push("Nothing is open in the register.", "");
  } else {
    out.push(`${risks.open} open: ${risks.high} high severity, ${risks.overdue} past the due date.`, "");
    const flagged = open.filter((r) => riskSeverity(r) === "high" || isRiskOverdue(r, today));
    if (flagged.length) {
      out.push(
        ...flagged.map(
          (r) => `- ${r.title} (${RISK_KIND_LABELS[r.kind].toLowerCase()}, ${riskSeverity(r)} severity${r.owner ? `, ${r.owner}` : ""}${isRiskOverdue(r, today) ? `, action was due ${day(r.dueDate!)}` : ""})`,
        ),
        "",
      );
    }
  }

  return out.join("\n").trimEnd() + "\n";
}

// ----------------------------------------------------------------- messages

const firstName = (name: string) => name.trim().split(/\s+/)[0] || name;
const sameName = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase() && a.trim() !== "";

/**
 * Drafts one update request per team member, listing exactly what you need
 * from them today, plus one message to the whole team carrying the summary.
 * A member is asked about their workstream's milestones and budget lines and
 * about any risk or issue they own (matched by name).
 */
export function buildTeamMessages(input: {
  snapshot: ProgramSnapshot;
  analysis: ScheduleAnalysis;
  members: readonly TeamMember[];
  /** The daily summary markdown, for the all-team message. Omit to skip it. */
  summary?: string;
  today: DateString;
}): CommunicationDraft[] {
  const { snapshot, analysis, members, today } = input;
  const projectName = snapshot.project.name;
  const checkin = buildDailyCheckin(snapshot, analysis, today);
  const drafts: CommunicationDraft[] = [];

  for (const member of members) {
    const group = member.workstreamId ? snapshot.workstreams.find((w) => w.workstream?.id === member.workstreamId) : undefined;
    const ws = group?.workstream ?? null;
    const milestones = ws ? checkin.milestones.filter((q) => q.milestone.workstreamId === ws.id) : [];
    const lines = ws ? checkin.budgetLines.filter((q) => q.line.workstreamId === ws.id) : [];
    const openRisks = snapshot.workstreams.flatMap((w) => w.risks).filter((r) => r.status !== "closed");
    const owned = openRisks.filter((r) => sameName(r.owner, member.name));
    const inWorkstream = ws ? openRisks.filter((r) => r.workstreamId === ws.id && !owned.includes(r) && riskSeverity(r) === "high") : [];

    const body: string[] = [`Hi ${firstName(member.name)},`, ""];
    const asks = milestones.length + lines.length + owned.length + inWorkstream.length;
    body.push(
      asks > 0 || ws
        ? `For today's ${projectName} update${ws ? ` on ${ws.name}` : ""}, please reply with where these stand:`
        : `For today's ${projectName} update, please reply with anything that changed in your area today.`,
      "",
    );

    if (milestones.length) {
      body.push("Milestones");
      for (const q of milestones) {
        body.push(`- ${q.milestone.name}: target ${day(q.milestone.targetDate)} (${q.reasons.join("; ")}). Is that date still right, or is it done?`);
      }
      body.push("");
    }
    if (ws) {
      body.push("Progress", `- ${ws.name} is recorded as ${ws.percentComplete}% complete. What is it now?`, "");
    }
    if (lines.length) {
      body.push("Budget");
      for (const q of lines) {
        const over = q.line.forecast > q.line.budget ? `, ${formatMoney(q.line.forecast - q.line.budget)} over budget` : "";
        body.push(`- ${q.line.name}: spent ${formatMoney(q.line.spent)}, committed ${formatMoney(q.line.committed)}, forecast ${formatMoney(q.line.forecast)}${over}. Any change?`);
      }
      body.push("");
    }
    if (owned.length || inWorkstream.length) {
      body.push("Risks and issues");
      for (const r of owned) {
        body.push(`- ${r.title} (yours, ${riskSeverity(r)} severity${r.dueDate ? `, action ${r.dueDate < today ? "was due" : "due"} ${day(r.dueDate)}` : ""}). What is the status?`);
      }
      for (const r of inWorkstream) body.push(`- ${r.title} (high severity, in your workstream). Anything new?`);
      body.push("");
    }
    body.push("Also tell me about any new risks, blockers, or decisions you need from me.", "", "Thanks");

    drafts.push({
      memberId: member.id,
      kind: "update_request",
      recipient: member.name,
      email: member.email,
      subject: `${projectName}: daily update for ${day(today)}`,
      body: body.join("\n"),
    });
  }

  if (input.summary && members.length) {
    drafts.push({
      memberId: null,
      kind: "summary",
      recipient: "Whole team",
      email: members.map((m) => m.email).filter(Boolean).join(", "),
      subject: dailySummaryTitle(projectName, today),
      body: `Team,\n\nHere is today's summary.\n\n${markdownToPlain(input.summary)}`,
    });
  }
  return drafts;
}

/** Light markdown-to-text for email bodies: drops heading marks and bold, keeps lists. */
export function markdownToPlain(markdown: string): string {
  return markdown
    .split("\n")
    .filter((line, i) => !(i === 0 && line.startsWith("# ")))
    .map((line) => line.replace(/^#{1,6}\s+/, "").replace(/\*\*(.+?)\*\*/g, "$1"))
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
