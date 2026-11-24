"use server";

// Server actions for the /pm tool. Each one checks access, validates its
// input with zod, calls the data layer, and returns an ActionResult instead
// of throwing, so the UI can roll back optimistic updates and show the error.
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { z } from "zod";
import { hasAccess } from "./access";
import * as budget from "./budget";
import * as milestones from "./milestones";
import { getProgramSnapshot } from "./program";
import { buildStatusReport, reportTitle } from "./report-builder";
import * as reports from "./reports";
import * as risks from "./risks";
import * as workstreams from "./workstreams";
import * as projects from "./projects";
import {
  createBudgetLineSchema,
  createMilestoneSchema,
  createRiskSchema,
  createWorkstreamSchema,
  generateReportSchema,
  updateBudgetLineSchema,
  updateReportSchema,
  updateRiskSchema,
  updateWorkstreamSchema,
  createProjectSchema,
  createSubtaskSchema,
  createTaskSchema,
  idSchema,
  moveTaskSchema,
  searchSchema,
  updateMilestoneSchema,
  updateProjectSchema,
  updateSubtaskSchema,
  updateTaskSchema,
  type CreateBudgetLineInput,
  type CreateMilestoneInput,
  type CreateRiskInput,
  type CreateWorkstreamInput,
  type GenerateReportInput,
  type UpdateBudgetLineInput,
  type UpdateReportInput,
  type UpdateRiskInput,
  type UpdateWorkstreamInput,
  type CreateProjectInput,
  type CreateSubtaskInput,
  type CreateTaskInput,
  type MoveTaskInput,
  type UpdateMilestoneInput,
  type UpdateProjectInput,
  type UpdateSubtaskInput,
  type UpdateTaskInput,
} from "./schemas";
import { searchTasks } from "./search";
import * as subtasks from "./subtasks";
import * as tasks from "./tasks";
import {
  PmNotFoundError,
  PmValidationError,
  type ActionResult,
  type BudgetLine,
  type Milestone,
  type Risk,
  type StatusReport,
  type Workstream,
  type Project,
  type SearchResult,
  type Subtask,
  type Task,
} from "./types";

async function run<S extends z.ZodType, T>(
  schema: S,
  input: unknown,
  fn: (data: z.output<S>) => Promise<T>,
  opts: { revalidate?: boolean } = {},
): Promise<ActionResult<T>> {
  if (!(await hasAccess())) return { ok: false, error: "The project tool is not available." };
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };
  try {
    const data = await fn(parsed.data);
    if (opts.revalidate !== false) revalidatePath("/pm", "layout");
    return { ok: true, data };
  } catch (error) {
    if (error instanceof PmNotFoundError) {
      // The page is showing something that no longer exists; refresh it.
      revalidatePath("/pm", "layout");
      return { ok: false, error: `${error.message}. It may have been deleted.` };
    }
    if (error instanceof PmValidationError) return { ok: false, error: error.message };
    console.error("[pm] action failed", error);
    return { ok: false, error: "Couldn't save that change. Try again." };
  }
}

// Projects

export async function createProjectAction(input: CreateProjectInput): Promise<ActionResult<Project>> {
  return run(createProjectSchema, input, (data) => projects.createProject(data));
}

export async function updateProjectAction(input: UpdateProjectInput): Promise<ActionResult<Project>> {
  return run(updateProjectSchema, input, ({ id, ...patch }) => projects.updateProject(id, patch));
}

/**
 * Deletes a project and sends the browser to the dashboard. The redirect
 * happens here, on the server, because the page that called this belongs to
 * the project that no longer exists. Only returns when the delete failed.
 */
export async function deleteProjectAction(input: { id: string }): Promise<ActionResult> {
  const result = await run(idSchema, input, async ({ id }) => {
    await projects.deleteProject(id);
    return null;
  });
  if (result.ok) redirect("/pm");
  return result;
}

// Tasks

export async function createTaskAction(input: CreateTaskInput): Promise<ActionResult<Task>> {
  return run(createTaskSchema, input, (data) => tasks.createTask(data));
}

export async function updateTaskAction(input: UpdateTaskInput): Promise<ActionResult<Task>> {
  return run(updateTaskSchema, input, ({ id, ...patch }) => tasks.updateTask(id, patch));
}

export async function moveTaskAction(input: MoveTaskInput): Promise<ActionResult<Task>> {
  return run(moveTaskSchema, input, ({ id, status, index }) => tasks.moveTask(id, status, index));
}

export async function deleteTaskAction(input: { id: string }): Promise<ActionResult> {
  return run(idSchema, input, async ({ id }) => {
    await tasks.deleteTask(id);
    return null;
  });
}

// Subtasks

export async function createSubtaskAction(input: CreateSubtaskInput): Promise<ActionResult<Subtask>> {
  return run(createSubtaskSchema, input, ({ taskId, title }) => subtasks.createSubtask(taskId, title));
}

export async function updateSubtaskAction(input: UpdateSubtaskInput): Promise<ActionResult<Subtask>> {
  return run(updateSubtaskSchema, input, ({ id, ...patch }) => subtasks.updateSubtask(id, patch));
}

export async function deleteSubtaskAction(input: { id: string }): Promise<ActionResult> {
  return run(idSchema, input, async ({ id }) => {
    await subtasks.deleteSubtask(id);
    return null;
  });
}

// Milestones

export async function createMilestoneAction(input: CreateMilestoneInput): Promise<ActionResult<Milestone>> {
  return run(createMilestoneSchema, input, (data) => milestones.createMilestone(data));
}

export async function updateMilestoneAction(input: UpdateMilestoneInput): Promise<ActionResult<Milestone>> {
  return run(updateMilestoneSchema, input, ({ id, ...patch }) => milestones.updateMilestone(id, patch));
}

export async function deleteMilestoneAction(input: { id: string }): Promise<ActionResult> {
  return run(idSchema, input, async ({ id }) => {
    await milestones.deleteMilestone(id);
    return null;
  });
}

// Workstreams

export async function createWorkstreamAction(input: CreateWorkstreamInput): Promise<ActionResult<Workstream>> {
  return run(createWorkstreamSchema, input, (data) => workstreams.createWorkstream(data));
}

export async function updateWorkstreamAction(input: UpdateWorkstreamInput): Promise<ActionResult<Workstream>> {
  return run(updateWorkstreamSchema, input, ({ id, ...patch }) => workstreams.updateWorkstream(id, patch));
}

export async function deleteWorkstreamAction(input: { id: string }): Promise<ActionResult> {
  return run(idSchema, input, async ({ id }) => {
    await workstreams.deleteWorkstream(id);
    return null;
  });
}

// Budget

export async function createBudgetLineAction(input: CreateBudgetLineInput): Promise<ActionResult<BudgetLine>> {
  return run(createBudgetLineSchema, input, (data) => budget.createBudgetLine(data));
}

export async function updateBudgetLineAction(input: UpdateBudgetLineInput): Promise<ActionResult<BudgetLine>> {
  return run(updateBudgetLineSchema, input, ({ id, ...patch }) => budget.updateBudgetLine(id, patch));
}

export async function deleteBudgetLineAction(input: { id: string }): Promise<ActionResult> {
  return run(idSchema, input, async ({ id }) => {
    await budget.deleteBudgetLine(id);
    return null;
  });
}

// Risks and issues

export async function createRiskAction(input: CreateRiskInput): Promise<ActionResult<Risk>> {
  return run(createRiskSchema, input, (data) => risks.createRisk(data));
}

export async function updateRiskAction(input: UpdateRiskInput): Promise<ActionResult<Risk>> {
  return run(updateRiskSchema, input, ({ id, ...patch }) => risks.updateRisk(id, patch));
}

export async function deleteRiskAction(input: { id: string }): Promise<ActionResult> {
  return run(idSchema, input, async ({ id }) => {
    await risks.deleteRisk(id);
    return null;
  });
}

// Status reports

/** Builds a report from the tracked data (no AI) and saves it. */
export async function generateReportAction(input: GenerateReportInput): Promise<ActionResult<StatusReport>> {
  return run(generateReportSchema, input, async ({ projectId, periodStart, periodEnd }) => {
    const project = await projects.getProjectById(projectId);
    if (!project) throw new PmNotFoundError("Project");
    const snapshot = await getProgramSnapshot(project);
    return reports.createReport({
      projectId,
      title: reportTitle(project.name, periodEnd),
      periodStart,
      periodEnd,
      body: buildStatusReport(snapshot, { start: periodStart, end: periodEnd }),
    });
  });
}

export async function updateReportAction(input: UpdateReportInput): Promise<ActionResult<StatusReport>> {
  return run(updateReportSchema, input, ({ id, ...patch }) => reports.updateReport(id, patch));
}

export async function deleteReportAction(input: { id: string }): Promise<ActionResult> {
  return run(idSchema, input, async ({ id }) => {
    await reports.deleteReport(id);
    return null;
  });
}

// Search (read-only, so nothing to revalidate)

export async function searchTasksAction(input: { query: string }): Promise<ActionResult<SearchResult[]>> {
  return run(searchSchema, input, ({ query }) => searchTasks(query), { revalidate: false });
}
