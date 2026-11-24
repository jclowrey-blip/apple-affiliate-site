// The assistant's tools: plain functions over the same data layer and zod
// schemas the UI uses. Nothing here depends on the Anthropic SDK, so the
// tools can be unit-tested and reused by any model harness.
//
// Deliberately absent: delete tools. The assistant can read, create and
// update; removing data is left to the person, in the UI.
import { z } from "zod";
import * as budget from "../budget";
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
} from "../schemas";
import { searchTasks } from "../search";
import * as tasks from "../tasks";
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
