"use server";

// Server actions: the only mutation entry points for the /pm UI. Each one
// checks access, validates input with zod, calls the data layer, and returns
// an ActionResult so the client can roll back optimistic updates on failure.
import { revalidatePath } from "next/cache";
import type { z } from "zod";
import { requirePmAccess } from "./access";
import { PmError } from "./errors";
import * as milestones from "./milestones";
import * as projects from "./projects";
import * as schemas from "./schemas";
import { searchTasks } from "./search";
import * as subtasks from "./subtasks";
import * as tasks from "./tasks";
import type { ActionResult, Milestone, Project, SearchResult, Subtask, Task } from "./types";

async function run<S extends z.ZodType, T>(
  schema: S,
  input: unknown,
  fn: (data: z.output<S>) => Promise<T>,
  { revalidate = true }: { revalidate?: boolean } = {},
): Promise<ActionResult<T>> {
  await requirePmAccess();
  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  try {
    const data = await fn(parsed.data);
    if (revalidate) revalidatePath("/pm", "layout");
    return { ok: true, data };
  } catch (err) {
    if (err instanceof PmError) return { ok: false, error: err.message };
    console.error("[pm] action failed", err);
    return { ok: false, error: "Something went wrong. Your change was not saved." };
  }
}

export async function createProjectAction(input: unknown): Promise<ActionResult<Project>> {
  return run(schemas.createProjectSchema, input, projects.createProject);
}

export async function updateProjectAction(input: unknown): Promise<ActionResult<Project>> {
  return run(schemas.updateProjectSchema, input, projects.updateProject);
}

export async function deleteProjectAction(input: unknown): Promise<ActionResult<void>> {
  return run(schemas.idSchema, input, ({ id }) => projects.deleteProject(id));
}

export async function createMilestoneAction(input: unknown): Promise<ActionResult<Milestone>> {
  return run(schemas.createMilestoneSchema, input, milestones.createMilestone);
}

export async function updateMilestoneAction(input: unknown): Promise<ActionResult<Milestone>> {
  return run(schemas.updateMilestoneSchema, input, milestones.updateMilestone);
}

export async function deleteMilestoneAction(input: unknown): Promise<ActionResult<void>> {
  return run(schemas.idSchema, input, ({ id }) => milestones.deleteMilestone(id));
}

export async function createTaskAction(input: unknown): Promise<ActionResult<Task>> {
  return run(schemas.createTaskSchema, input, tasks.createTask);
}

export async function updateTaskAction(input: unknown): Promise<ActionResult<Task>> {
  return run(schemas.updateTaskSchema, input, tasks.updateTask);
}

export async function moveTaskAction(input: unknown): Promise<ActionResult<void>> {
  return run(schemas.moveTaskSchema, input, async (data) => {
    await tasks.moveTask(data);
  });
}

export async function deleteTaskAction(input: unknown): Promise<ActionResult<void>> {
  return run(schemas.idSchema, input, ({ id }) => tasks.deleteTask(id));
}

export async function createSubtaskAction(input: unknown): Promise<ActionResult<Subtask>> {
  return run(schemas.createSubtaskSchema, input, subtasks.createSubtask);
}

export async function updateSubtaskAction(input: unknown): Promise<ActionResult<Subtask>> {
  return run(schemas.updateSubtaskSchema, input, subtasks.updateSubtask);
}

export async function deleteSubtaskAction(input: unknown): Promise<ActionResult<void>> {
  return run(schemas.idSchema, input, ({ id }) => subtasks.deleteSubtask(id));
}

export async function searchTasksAction(input: unknown): Promise<ActionResult<SearchResult[]>> {
  return run(schemas.searchSchema, input, ({ query }) => searchTasks(query), { revalidate: false });
}
