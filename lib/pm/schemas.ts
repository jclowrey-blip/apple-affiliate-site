// zod schemas for every mutation input. Server actions parse with these
// before calling the data layer.
import { z } from "zod";
import { PRIORITIES, PROJECT_STATUSES, TASK_STATUSES } from "./types";

const id = z.string().min(1).max(64);
const dateString = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Use a YYYY-MM-DD date")
  .refine((v) => !Number.isNaN(Date.parse(`${v}T00:00:00.000Z`)), "Not a real date");
const title = z.string().trim().min(1, "Title is required").max(200, "Title is too long");
const label = z.string().trim().toLowerCase().min(1).max(30, "Labels are limited to 30 characters");
const labels = z
  .array(label)
  .max(12, "At most 12 labels")
  .transform((list) => Array.from(new Set(list)));

export const taskStatusSchema = z.enum(TASK_STATUSES);
export const prioritySchema = z.enum(PRIORITIES);

export const createProjectSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(80, "Name is too long"),
  description: z.string().trim().max(500, "Description is too long").default(""),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/, "Color must be a hex value like #2F6F4E"),
  status: z.enum(PROJECT_STATUSES).default("active"),
});
export const updateProjectSchema = createProjectSchema.partial().extend({ id });

export const createTaskSchema = z.object({
  projectId: id,
  title,
  description: z.string().max(20_000, "Description is too long").default(""),
  status: taskStatusSchema.default("backlog"),
  priority: prioritySchema.default("medium"),
  dueDate: dateString.nullable().default(null),
  labels: labels.default([]),
  milestoneId: id.nullable().default(null),
});

export const updateTaskSchema = z.object({
  id,
  title: title.optional(),
  description: z.string().max(20_000, "Description is too long").optional(),
  status: taskStatusSchema.optional(),
  priority: prioritySchema.optional(),
  dueDate: dateString.nullable().optional(),
  labels: labels.optional(),
  milestoneId: id.nullable().optional(),
});

export const moveTaskSchema = z.object({
  id,
  status: taskStatusSchema,
  index: z.number().int().min(0),
});

export const createSubtaskSchema = z.object({ taskId: id, title });
export const updateSubtaskSchema = z.object({ id, title: title.optional(), done: z.boolean().optional() });

export const createMilestoneSchema = z.object({
  projectId: id,
  name: z.string().trim().min(1, "Name is required").max(80, "Name is too long"),
  targetDate: dateString,
});
export const updateMilestoneSchema = z.object({
  id,
  name: z.string().trim().min(1, "Name is required").max(80, "Name is too long").optional(),
  targetDate: dateString.optional(),
});

export const idSchema = z.object({ id });
export const searchSchema = z.object({ query: z.string().trim().max(100) });

export type CreateProjectInput = z.input<typeof createProjectSchema>;
export type UpdateProjectInput = z.input<typeof updateProjectSchema>;
export type CreateTaskInput = z.input<typeof createTaskSchema>;
export type UpdateTaskInput = z.input<typeof updateTaskSchema>;
export type MoveTaskInput = z.input<typeof moveTaskSchema>;
export type CreateSubtaskInput = z.input<typeof createSubtaskSchema>;
export type UpdateSubtaskInput = z.input<typeof updateSubtaskSchema>;
export type CreateMilestoneInput = z.input<typeof createMilestoneSchema>;
export type UpdateMilestoneInput = z.input<typeof updateMilestoneSchema>;
