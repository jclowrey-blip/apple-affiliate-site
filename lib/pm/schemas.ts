// zod schemas for every mutation input. Server actions parse with these before
// touching the data layer; the inferred types are the data layer's input types.
import { z } from "zod";
import { isISODate } from "./dates";
import { PRIORITIES, PROJECT_STATUSES, TASK_STATUSES } from "./types";

const id = z.string().min(1).max(64);
const isoDate = z.string().refine(isISODate, "Enter a valid date");
const title = z.string().trim().min(1, "Title is required").max(200, "Title is too long");
const label = z.string().trim().min(1).max(40, "Label is too long");
const labels = z
  .array(label)
  .max(20, "Too many labels")
  .transform((names) => Array.from(new Set(names)));

export const taskStatusSchema = z.enum(TASK_STATUSES);
export const prioritySchema = z.enum(PRIORITIES);

export const createProjectSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(80, "Name is too long"),
  description: z.string().trim().max(2000).default(""),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/, "Pick a color").default("#2F6F4E"),
  status: z.enum(PROJECT_STATUSES).default("active"),
});
export type CreateProjectInput = z.infer<typeof createProjectSchema>;

export const updateProjectSchema = z.object({
  id,
  name: createProjectSchema.shape.name.optional(),
  description: z.string().trim().max(2000).optional(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/, "Pick a color").optional(),
  status: z.enum(PROJECT_STATUSES).optional(),
});
export type UpdateProjectInput = z.infer<typeof updateProjectSchema>;

export const createMilestoneSchema = z.object({
  projectId: id,
  name: z.string().trim().min(1, "Name is required").max(80, "Name is too long"),
  targetDate: isoDate,
});
export type CreateMilestoneInput = z.infer<typeof createMilestoneSchema>;

export const updateMilestoneSchema = z.object({
  id,
  name: createMilestoneSchema.shape.name.optional(),
  targetDate: isoDate.optional(),
});
export type UpdateMilestoneInput = z.infer<typeof updateMilestoneSchema>;

export const createTaskSchema = z.object({
  projectId: id,
  title,
  description: z.string().max(20000, "Description is too long").default(""),
  status: taskStatusSchema.default("todo"),
  priority: prioritySchema.default("medium"),
  dueDate: isoDate.nullable().default(null),
  labels: labels.default([]),
  milestoneId: id.nullable().default(null),
});
export type CreateTaskInput = z.infer<typeof createTaskSchema>;

export const updateTaskSchema = z.object({
  id,
  title: title.optional(),
  description: z.string().max(20000, "Description is too long").optional(),
  status: taskStatusSchema.optional(),
  priority: prioritySchema.optional(),
  dueDate: isoDate.nullable().optional(),
  labels: labels.optional(),
  milestoneId: id.nullable().optional(),
});
export type UpdateTaskInput = z.infer<typeof updateTaskSchema>;

export const moveTaskSchema = z.object({
  id,
  status: taskStatusSchema,
  index: z.number().int().min(0),
});
export type MoveTaskInput = z.infer<typeof moveTaskSchema>;

export const createSubtaskSchema = z.object({ taskId: id, title });
export type CreateSubtaskInput = z.infer<typeof createSubtaskSchema>;

export const updateSubtaskSchema = z.object({
  id,
  title: title.optional(),
  done: z.boolean().optional(),
});
export type UpdateSubtaskInput = z.infer<typeof updateSubtaskSchema>;

export const idSchema = z.object({ id });
export const searchSchema = z.object({ query: z.string().trim().max(100) });
