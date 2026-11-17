"use server";

// Server actions for the /pm tool. Each one checks access, validates its
// input with zod, calls the data layer, and returns an ActionResult instead
// of throwing, so the UI can roll back optimistic updates and show the error.
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { z } from "zod";
import { hasAccess } from "./access";
import * as milestones from "./milestones";
import * as projects from "./projects";
import {
  createMilestoneSchema,
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
  type CreateMilestoneInput,
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
  type ActionResult,
  type Milestone,
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
  if (!hasAccess()) return { ok: false, error: "The project tool is not available." };
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

// Search (read-only, so nothing to revalidate)

export async function searchTasksAction(input: { query: string }): Promise<ActionResult<SearchResult[]>> {
  return run(searchSchema, input, ({ query }) => searchTasks(query), { revalidate: false });
}
