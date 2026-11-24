// The assistant's tools: plain functions over the same data layer and zod
// schemas the UI uses. Nothing here depends on the Anthropic SDK, so the
// tools can be unit-tested and reused by any model harness.
//
// Deliberately absent: delete tools. The assistant can read, create and
// update; removing data is left to the person, in the UI.
import { z } from "zod";
import { logActivity } from "../activity";
import * as budget from "../budget";
import { createCommunication, listCommunications } from "../communications";
import { finishDay, loadDailyContext } from "../daily-run";
import { todayString } from "../dates";
import * as milestones from "../milestones";
import { getProgramSnapshot } from "../program";
import { getProjectBySlug, listProjects } from "../projects";
import { buildStatusReport } from "../report-builder";
import * as reports from "../reports";
import * as risks from "../risks";
import {
  createBudgetLineSchema,
  createMilestoneSchema,
  createRiskSchema,
  createTaskSchema,
  createWorkstreamSchema,
  updateBudgetLineSchema,
  updateMilestoneSchema,
  updateRiskSchema,
  updateTaskSchema,
  updateWorkstreamSchema,
} from "../schemas";
import { searchTasks } from "../search";
import * as tasks from "../tasks";
import { listMembers } from "../team";
import { PRIORITIES, PmNotFoundError, PmValidationError, RISK_KINDS, RISK_STATUSES, TASK_STATUSES, type Project } from "../types";
import * as workstreams from "../workstreams";

export type AssistantTool = {
  name: string;
  description: string;
  /** Short present-tense label shown in the chat while the tool runs. */
  label: string;
  /** True when the tool changes stored data. */
  mutates: boolean;
  schema: z.ZodObject;
  run: (input: never) => Promise<unknown>;
};

const project = z.string().describe("Project slug, as returned by list_projects (e.g. \"home-lab\").");
const date = z.string().describe("Calendar date, YYYY-MM-DD.");
const money = z.number().describe("Whole US dollars, e.g. 2400000000 for $2.4B.");
const level = z.number().int().min(1).max(3).describe("1 = low, 2 = medium, 3 = high.");

async function resolveProject(slug: string): Promise<Project> {
  const found = await getProjectBySlug(slug);
  if (!found) throw new PmNotFoundError(`Project "${slug}"`);
  return found;
}

function tool<S extends z.ZodObject>(def: {
  name: string;
  description: string;
  label: string;
  mutates: boolean;
  schema: S;
  run: (input: z.output<S>) => Promise<unknown>;
}): AssistantTool {
  return def as unknown as AssistantTool;
}

export const assistantTools: AssistantTool[] = [
  tool({
    name: "list_projects",
    description: "List every project with its slug, status, approved budget and task progress. Call this first when you don't know which project the user means.",
    label: "Listing projects",
    mutates: false,
    schema: z.object({}),
    run: async () =>
      (await listProjects()).map((p) => ({
        slug: p.slug,
        name: p.name,
        description: p.description,
        status: p.status,
        approvedBudget: p.budget,
        tasksDone: p.doneTasks,
        tasksTotal: p.totalTasks,
      })),
  }),
  tool({
    name: "get_program_status",
    description:
      "Full current picture of one project: overall red/amber/green status with reasons, every workstream with its milestones (baseline, target, slippage in days, health, unfinished dependencies due later), budget lines and totals (budget, committed, spent, forecast, variance = budget - forecast), and risks and issues. Includes the ids needed by the update tools. This is the source of truth for schedule, budget and risk questions.",
    label: "Reading program status",
    mutates: false,
    schema: z.object({ project }),
    run: async (input) => getProgramSnapshot(await resolveProject(input.project)),
  }),
  tool({
    name: "list_tasks",
    description: "List a project's tasks, optionally only one status or only overdue unfinished ones. Returns ids, titles, status, priority, due date, labels, milestone id and subtask progress.",
    label: "Reading tasks",
    mutates: false,
    schema: z.object({
      project,
      status: z.enum(TASK_STATUSES).optional(),
      overdueOnly: z.boolean().optional().describe("Only unfinished tasks whose due date has passed."),
    }),
    run: async (input) => {
      const today = todayString();
      return (await tasks.listTasks((await resolveProject(input.project)).id))
        .filter((t) => !input.status || t.status === input.status)
        .filter((t) => !input.overdueOnly || (t.status !== "done" && t.dueDate !== null && t.dueDate < today))
        .map((t) => ({
          id: t.id,
          title: t.title,
          status: t.status,
          priority: t.priority,
          dueDate: t.dueDate,
          labels: t.labels,
          milestoneId: t.milestoneId,
          subtasksDone: t.subtasks.filter((s) => s.done).length,
          subtasksTotal: t.subtasks.length,
          hasDescription: t.description.length > 0,
        }));
    },
  }),
  tool({
    name: "search_tasks",
    description: "Find tasks in any project whose title or description contains the given text.",
    label: "Searching tasks",
    mutates: false,
    schema: z.object({ query: z.string().min(1) }),
    run: async (input) => searchTasks(input.query),
  }),
  tool({
    name: "create_task",
    description: "Create a task in a project. It goes to the end of its status column (backlog unless given).",
    label: "Creating a task",
    mutates: true,
    schema: z.object({
      project,
      title: z.string(),
      description: z.string().optional().describe("Markdown."),
      status: z.enum(TASK_STATUSES).optional(),
      priority: z.enum(PRIORITIES).optional(),
      dueDate: date.optional(),
      labels: z.array(z.string()).optional(),
      milestoneId: z.string().optional(),
    }),
    run: async ({ project: slug, ...rest }) => tasks.createTask(createTaskSchema.parse({ projectId: (await resolveProject(slug)).id, ...rest })),
  }),
  tool({
    name: "update_task",
    description: "Change fields on a task. Only the fields you pass change. Pass null for dueDate or milestoneId to clear it.",
    label: "Updating a task",
    mutates: true,
    schema: z.object({
      taskId: z.string(),
      title: z.string().optional(),
      description: z.string().optional(),
      status: z.enum(TASK_STATUSES).optional(),
      priority: z.enum(PRIORITIES).optional(),
      dueDate: date.nullable().optional(),
      labels: z.array(z.string()).optional().describe("Replaces the whole label list."),
      milestoneId: z.string().nullable().optional(),
    }),
    run: async ({ taskId, ...rest }) => {
      const { id, ...patch } = updateTaskSchema.parse({ id: taskId, ...rest });
      return tasks.updateTask(id, patch);
    },
  }),
  tool({
    name: "create_workstream",
    description: "Add a workstream (a major strand of a large program) to a project.",
    label: "Creating a workstream",
    mutates: true,
    schema: z.object({ project, name: z.string(), owner: z.string().optional(), description: z.string().optional() }),
    run: async ({ project: slug, ...rest }) => workstreams.createWorkstream(createWorkstreamSchema.parse({ projectId: (await resolveProject(slug)).id, ...rest })),
  }),
  tool({
    name: "update_workstream",
    description:
      "Change a workstream: its percent complete (0-100, which drives earned value), owner, name, description, or the planned start and finish its budget is spread across. Only the fields you pass change.",
    label: "Updating a workstream",
    mutates: true,
    schema: z.object({
      workstreamId: z.string(),
      name: z.string().optional(),
      owner: z.string().optional(),
      description: z.string().optional(),
      percentComplete: z.number().int().min(0).max(100).optional(),
      plannedStart: date.nullable().optional(),
      plannedFinish: date.nullable().optional(),
    }),
    run: async ({ workstreamId, ...rest }) => {
      const { id, ...patch } = updateWorkstreamSchema.parse({ id: workstreamId, ...rest });
      return workstreams.updateWorkstream(id, patch);
    },
  }),
  tool({
    name: "create_milestone",
    description: "Add a milestone to a project. Its baseline date is set to the target date.",
    label: "Creating a milestone",
    mutates: true,
    schema: z.object({ project, name: z.string(), targetDate: date, workstreamId: z.string().optional() }),
    run: async ({ project: slug, ...rest }) => milestones.createMilestone(createMilestoneSchema.parse({ projectId: (await resolveProject(slug)).id, ...rest })),
  }),
  tool({
    name: "update_milestone",
    description:
      "Change a milestone. Moving targetDate keeps the baseline, which is how slippage is recorded; only pass baselineDate when the user explicitly wants to re-baseline. Set completedDate to mark it done (null to reopen). dependsOnIds replaces the full list of milestones that must finish first; loops are rejected.",
    label: "Updating a milestone",
    mutates: true,
    schema: z.object({
      milestoneId: z.string(),
      name: z.string().optional(),
      targetDate: date.optional(),
      baselineDate: date.optional(),
      completedDate: date.nullable().optional(),
      workstreamId: z.string().nullable().optional(),
      dependsOnIds: z.array(z.string()).optional(),
    }),
    run: async ({ milestoneId, ...rest }) => {
      const { id, ...patch } = updateMilestoneSchema.parse({ id: milestoneId, ...rest });
      return milestones.updateMilestone(id, patch);
    },
  }),
  tool({
    name: "create_budget_line",
    description: "Add a budget line to a workstream. Forecast defaults to the budget.",
    label: "Creating a budget line",
    mutates: true,
    schema: z.object({
      workstreamId: z.string(),
      name: z.string(),
      budget: money.optional(),
      committed: money.optional(),
      spent: money.optional(),
      forecast: money.optional(),
    }),
    run: async (input) => budget.createBudgetLine(createBudgetLineSchema.parse(input)),
  }),
  tool({
    name: "update_budget_line",
    description: "Change a budget line's name or amounts. Only the fields you pass change.",
    label: "Updating a budget line",
    mutates: true,
    schema: z.object({
      budgetLineId: z.string(),
      name: z.string().optional(),
      budget: money.optional(),
      committed: money.optional(),
      spent: money.optional(),
      forecast: money.optional().describe("Expected final cost."),
    }),
    run: async ({ budgetLineId, ...rest }) => {
      const { id, ...patch } = updateBudgetLineSchema.parse({ id: budgetLineId, ...rest });
      return budget.updateBudgetLine(id, patch);
    },
  }),
  tool({
    name: "create_risk",
    description: "Log a risk (might happen) or an issue (has happened) in a project's register. Severity is derived: likelihood x impact for a risk, impact alone for an issue.",
    label: "Logging a risk or issue",
    mutates: true,
    schema: z.object({
      project,
      title: z.string(),
      kind: z.enum(RISK_KINDS).optional(),
      likelihood: level.optional(),
      impact: level.optional(),
      status: z.enum(RISK_STATUSES).optional(),
      owner: z.string().optional(),
      dueDate: date.optional(),
      workstreamId: z.string().optional(),
      description: z.string().optional(),
      mitigation: z.string().optional(),
    }),
    run: async ({ project: slug, ...rest }) => risks.createRisk(createRiskSchema.parse({ projectId: (await resolveProject(slug)).id, ...rest })),
  }),
  tool({
    name: "update_risk",
    description: "Change a risk or issue. Only the fields you pass change. Pass null for dueDate or workstreamId to clear it.",
    label: "Updating a risk or issue",
    mutates: true,
    schema: z.object({
      riskId: z.string(),
      title: z.string().optional(),
      kind: z.enum(RISK_KINDS).optional(),
      likelihood: level.optional(),
      impact: level.optional(),
      status: z.enum(RISK_STATUSES).optional(),
      owner: z.string().optional(),
      dueDate: date.nullable().optional(),
      workstreamId: z.string().nullable().optional(),
      description: z.string().optional(),
      mitigation: z.string().optional(),
    }),
    run: async ({ riskId, ...rest }) => {
      const { id, ...patch } = updateRiskSchema.parse({ id: riskId, ...rest });
      return risks.updateRisk(id, patch);
    },
  }),
  tool({
    name: "get_schedule_and_cost_performance",
    description:
      "Timing and cost analysis for one project. Schedule: baseline finish, projected finish and the days between them; each milestone's projected date, slip against baseline and float; and the critical path (the chain of milestones where a day's slip moves the finish). Cost: earned value per workstream and in total (budget, planned value, earned value, actual cost, cost and schedule variance, CPI, SPI, estimate at completion). A null PV or SPI means that workstream has no planned start and finish; say so rather than estimating.",
    label: "Analysing schedule and cost performance",
    mutates: false,
    schema: z.object({ project }),
    run: async (input) => {
      const { analysis, performance } = await loadDailyContext(await resolveProject(input.project));
      const name = (id: string) => analysis.nodes.find((n) => n.id === id)?.name ?? id;
      return {
        schedule: {
          baselineFinish: analysis.baselineFinish,
          projectedFinish: analysis.forecastFinish,
          finishSlipDays: analysis.finishSlipDays,
          hasDependencies: analysis.hasDependencies,
          criticalPath: analysis.criticalPath.map(name),
          milestones: analysis.nodes.map((n) => ({
            id: n.id,
            name: n.name,
            baselineDate: n.baselineDate,
            targetDate: n.targetDate,
            completedDate: n.completedDate,
            projectedDate: n.forecastDate,
            slipDays: n.forecastSlipDays,
            floatDays: n.floatDays,
            critical: n.critical,
            drivenBy: n.drivenById ? name(n.drivenById) : null,
          })),
          milestonesPlannedByNow: performance.milestones.plannedByNow,
          milestonesPlannedByNowDone: performance.milestones.plannedDone,
        },
        earnedValue: { workstreams: performance.workstreams, total: performance.total, workstreamsMissingPlannedDates: performance.missingPlan },
      };
    },
  }),
  tool({
    name: "get_daily_checkin",
    description:
      "What needs confirming with the user today for one project: unfinished milestones that are late, due within 14 days or critical; every workstream's recorded percent complete; budget lines with money moving; open risks and issues that are overdue, due this week or high severity. Also returns what has already been changed or noted today, and the team members. Use it to decide what to ask in a daily check-in.",
    label: "Reading today's check-in",
    mutates: false,
    schema: z.object({ project }),
    run: async (input) => {
      const context = await loadDailyContext(await resolveProject(input.project));
      return {
        today: context.today,
        milestones: context.checkin.milestones.map((q) => ({ id: q.milestone.id, name: q.milestone.name, workstream: q.workstream, targetDate: q.milestone.targetDate, baselineDate: q.milestone.baselineDate, why: q.reasons })),
        workstreams: context.checkin.workstreams.map((w) => ({ id: w.id, name: w.name, owner: w.owner, percentComplete: w.percentComplete })),
        budgetLines: context.checkin.budgetLines.map((q) => ({ id: q.line.id, name: q.line.name, workstream: q.workstream, budget: q.line.budget, committed: q.line.committed, spent: q.line.spent, forecast: q.line.forecast })),
        risks: context.checkin.risks.map((q) => ({ id: q.risk.id, title: q.risk.title, kind: q.risk.kind, status: q.risk.status, owner: q.risk.owner, workstream: q.workstream, why: q.reasons })),
        alreadyRecordedToday: context.activities.map((a) => ({ kind: a.kind, summary: a.summary })),
        team: context.members.map((m) => ({ id: m.id, name: m.name, role: m.role, workstreamId: m.workstreamId, hasEmail: m.email !== "" })),
      };
    },
  }),
  tool({
    name: "add_note",
    description: "Record something the user told you that isn't a field in the tracker (a decision, a blocker, context). Notes appear in today's daily summary.",
    label: "Saving a note",
    mutates: true,
    schema: z.object({ project, text: z.string().min(1).max(2000) }),
    run: async (input) => {
      await logActivity((await resolveProject(input.project)).id, input.text.trim(), "note");
      return { saved: true };
    },
  }),
  tool({
    name: "finish_day",
    description:
      "Close out today for a project: saves the daily summary (built from the tracked data and today's changes and notes) to the Reports tab, and drafts today's update-request message for each team member plus one summary message to the whole team, on the Team tab. Nothing is sent to anyone. Call it once, after the day's updates are in. Returns the summary text.",
    label: "Saving the daily summary and drafting team messages",
    mutates: true,
    schema: z.object({ project, notes: z.string().max(5000).optional().describe("Any last notes to record before the summary is built.") }),
    run: async (input) => {
      const { report, messages } = await finishDay(await resolveProject(input.project), input.notes ?? "");
      return { summary: report.body, reportId: report.id, messagesDrafted: messages.map((m) => ({ id: m.id, to: m.recipient, kind: m.kind, hasEmail: m.email !== "" })) };
    },
  }),
  tool({
    name: "list_team_messages",
    description: "List the messages drafted for the team (recipient, subject, day, draft or sent), newest day first. Includes the full text.",
    label: "Reading drafted messages",
    mutates: false,
    schema: z.object({ project }),
    run: async (input) => (await listCommunications((await resolveProject(input.project)).id, 40)).map((m) => ({ id: m.id, to: m.recipient, subject: m.subject, forDate: m.forDate, status: m.status, kind: m.kind, body: m.body })),
  }),
  tool({
    name: "draft_team_message",
    description:
      "Save a message you have written for a team member (or the whole team) as a draft on the Team tab, for the user to review and send themselves. You cannot send messages. Use plain text, not markdown.",
    label: "Drafting a message",
    mutates: true,
    schema: z.object({
      project,
      memberId: z.string().optional().describe("Team member id from get_daily_checkin. Omit for a message to someone not on the team list."),
      recipient: z.string().optional().describe("Recipient name; required when memberId is omitted."),
      subject: z.string().min(1).max(200),
      body: z.string().min(1).max(50_000),
    }),
    run: async (input) => {
      const found = await resolveProject(input.project);
      const member = input.memberId ? (await listMembers(found.id)).find((m) => m.id === input.memberId) : undefined;
      if (input.memberId && !member) throw new PmNotFoundError("Team member");
      if (!member && !input.recipient?.trim()) throw new PmValidationError("Give either a memberId or a recipient name.");
      const saved = await createCommunication({
        projectId: found.id,
        forDate: todayString(),
        memberId: member?.id ?? null,
        recipient: member?.name ?? input.recipient!.trim(),
        email: member?.email ?? "",
        subject: input.subject,
        body: input.body,
        source: "assistant",
      });
      return { id: saved.id, to: saved.recipient, saved: true, sent: false };
    },
  }),
  tool({
    name: "build_status_report",
    description:
      "Build a status report for a period, in markdown, computed directly from the tracked data. Use it as the factual base when drafting a report: keep its figures exactly, then add narrative. Does not save anything.",
    label: "Building a status report from the data",
    mutates: false,
    schema: z.object({ project, periodStart: date, periodEnd: date }),
    run: async (input) => buildStatusReport(await getProgramSnapshot(await resolveProject(input.project)), { start: input.periodStart, end: input.periodEnd }),
  }),
  tool({
    name: "save_status_report",
    description: "Save a finished status report (markdown) to the project's Reports tab.",
    label: "Saving the report",
    mutates: true,
    schema: z.object({ project, title: z.string().min(1).max(200), periodStart: date, periodEnd: date, body: z.string().min(1).max(100_000).describe("The full report in markdown.") }),
    run: async ({ project: slug, ...rest }) => {
      const saved = await reports.createReport({ projectId: (await resolveProject(slug)).id, ...rest, source: "assistant" });
      return { id: saved.id, title: saved.title, saved: true };
    },
  }),
  tool({
    name: "list_status_reports",
    description: "List a project's saved status reports (id, title, period), newest first.",
    label: "Listing saved reports",
    mutates: false,
    schema: z.object({ project }),
    run: async (input) =>
      (await reports.listReports((await resolveProject(input.project)).id)).map((r) => ({ id: r.id, title: r.title, periodStart: r.periodStart, periodEnd: r.periodEnd, source: r.source })),
  }),
  tool({
    name: "get_status_report",
    description: "Read one saved status report in full.",
    label: "Reading a saved report",
    mutates: false,
    schema: z.object({ reportId: z.string() }),
    run: async (input) => {
      const report = await reports.getReport(input.reportId);
      if (!report) throw new PmNotFoundError("Report");
      return report;
    },
  }),
];

export type ToolOutcome = { ok: boolean; mutated: boolean; content: string };

/**
 * Runs one tool call. Never throws: bad input and missing records come back
 * as an error message the model can read and correct.
 */
export async function executeTool(name: string, input: unknown): Promise<ToolOutcome> {
  const found = assistantTools.find((t) => t.name === name);
  if (!found) return { ok: false, mutated: false, content: `Error: there is no tool named "${name}".` };
  const parsed = found.schema.safeParse(input);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return { ok: false, mutated: false, content: `Error: invalid input for ${name}: ${issue?.path.join(".") || "input"}: ${issue?.message}` };
  }
  try {
    const result = await found.run(parsed.data as never);
    return { ok: true, mutated: found.mutates, content: typeof result === "string" ? result : JSON.stringify(result) };
  } catch (error) {
    if (error instanceof PmNotFoundError) return { ok: false, mutated: false, content: `Error: ${error.message}. Check the id or slug with a read tool.` };
    if (error instanceof PmValidationError) return { ok: false, mutated: false, content: `Error: ${error.message}` };
    if (error instanceof z.ZodError) return { ok: false, mutated: false, content: `Error: ${error.issues[0]?.message ?? "invalid input"}` };
    console.error(`[pm] assistant tool ${name} failed`, error);
    return { ok: false, mutated: false, content: "Error: the tool failed unexpectedly. Nothing was changed." };
  }
}
