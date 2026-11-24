// zod schemas for every mutation input. Server actions parse with these
// before calling the data layer.
import { z } from "zod";
import { PRIORITIES, PROJECT_STATUSES, RISK_KINDS, RISK_STATUSES, TASK_STATUSES } from "./types";

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

const name = z.string().trim().min(1, "Name is required").max(80, "Name is too long");
const person = z.string().trim().max(80, "Owner is too long");
/** Whole dollars, up to $10 trillion. */
const money = z.number("Enter an amount").int("Use whole dollars").min(0, "Amounts can't be negative").max(1e13, "Amount is too large");
const level = z.union([z.literal(1), z.literal(2), z.literal(3)]);

export const taskStatusSchema = z.enum(TASK_STATUSES);
export const prioritySchema = z.enum(PRIORITIES);

export const createProjectSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(80, "Name is too long"),
  description: z.string().trim().max(500, "Description is too long").default(""),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/, "Color must be a hex value like #2F6F4E"),
  status: z.enum(PROJECT_STATUSES).default("active"),
  budget: money.default(0),
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
  name,
  targetDate: dateString,
  baselineDate: dateString.optional(),
  workstreamId: id.nullable().optional(),
});
export const updateMilestoneSchema = z.object({
  id,
  name: name.optional(),
  targetDate: dateString.optional(),
  baselineDate: dateString.optional(),
  completedDate: dateString.nullable().optional(),
  workstreamId: id.nullable().optional(),
  dependsOnIds: z.array(id).max(50).optional(),
});

const percent = z.number("Enter a percentage").int("Use a whole number").min(0, "Percent complete can't be below 0").max(100, "Percent complete can't be above 100");

export const createWorkstreamSchema = z.object({
  projectId: id,
  name,
  description: z.string().trim().max(500, "Description is too long").default(""),
  owner: person.default(""),
  percentComplete: percent.optional(),
  plannedStart: dateString.nullable().optional(),
  plannedFinish: dateString.nullable().optional(),
});
export const updateWorkstreamSchema = z
  .object({
    id,
    name: name.optional(),
    description: z.string().trim().max(500, "Description is too long").optional(),
    owner: person.optional(),
    percentComplete: percent.optional(),
    plannedStart: dateString.nullable().optional(),
    plannedFinish: dateString.nullable().optional(),
  })
  .refine((v) => !v.plannedStart || !v.plannedFinish || v.plannedStart <= v.plannedFinish, "Planned start must be before planned finish");

const email = z.union([z.literal(""), z.email("That doesn't look like an email address")]);
export const createMemberSchema = z.object({
  projectId: id,
  name,
  role: z.string().trim().max(80, "Role is too long").default(""),
  email: z.string().trim().max(200).pipe(email).default(""),
  workstreamId: id.nullable().optional(),
});
export const updateMemberSchema = z.object({
  id,
  name: name.optional(),
  role: z.string().trim().max(80, "Role is too long").optional(),
  email: z.string().trim().max(200).pipe(email).optional(),
  workstreamId: id.nullable().optional(),
});

export const updateCommunicationSchema = z.object({
  id,
  subject: z.string().trim().min(1, "Subject is required").max(200, "Subject is too long").optional(),
  body: z.string().min(1, "The message is empty").max(50_000, "Message is too long").optional(),
  status: z.enum(["draft", "sent"]).optional(),
});

export const finishDaySchema = z.object({ projectId: id, notes: z.string().max(5000, "Notes are too long").default("") });
export const noteSchema = z.object({ projectId: id, text: z.string().trim().min(1, "Write a note first").max(2000, "Note is too long") });
export const projectIdSchema = z.object({ projectId: id });

export const createBudgetLineSchema = z.object({
  workstreamId: id,
  name,
  budget: money.default(0),
  committed: money.default(0),
  spent: money.default(0),
  forecast: money.optional(),
});
export const updateBudgetLineSchema = z.object({
  id,
  name: name.optional(),
  budget: money.optional(),
  committed: money.optional(),
  spent: money.optional(),
  forecast: money.optional(),
});

const riskFields = {
  kind: z.enum(RISK_KINDS),
  description: z.string().max(5000, "Description is too long"),
  mitigation: z.string().max(5000, "Mitigation is too long"),
  owner: person,
  likelihood: level,
  impact: level,
  status: z.enum(RISK_STATUSES),
  dueDate: dateString.nullable(),
  workstreamId: id.nullable(),
};
export const createRiskSchema = z.object({ projectId: id, title }).extend(z.object(riskFields).partial().shape);
export const updateRiskSchema = z.object({ id, title: title.optional() }).extend(z.object(riskFields).partial().shape);

export const generateReportSchema = z
  .object({ projectId: id, periodStart: dateString, periodEnd: dateString })
  .refine((v) => v.periodStart <= v.periodEnd, "The period must start before it ends");
export const updateReportSchema = z.object({
  id,
  title: z.string().trim().min(1, "Title is required").max(200, "Title is too long").optional(),
  body: z.string().max(100_000, "Report is too long").optional(),
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
export type CreateWorkstreamInput = z.input<typeof createWorkstreamSchema>;
export type UpdateWorkstreamInput = z.input<typeof updateWorkstreamSchema>;
export type CreateMemberInput = z.input<typeof createMemberSchema>;
export type UpdateMemberInput = z.input<typeof updateMemberSchema>;
export type UpdateCommunicationInput = z.input<typeof updateCommunicationSchema>;
export type CreateBudgetLineInput = z.input<typeof createBudgetLineSchema>;
export type UpdateBudgetLineInput = z.input<typeof updateBudgetLineSchema>;
export type CreateRiskInput = z.input<typeof createRiskSchema>;
export type UpdateRiskInput = z.input<typeof updateRiskSchema>;
export type GenerateReportInput = z.input<typeof generateReportSchema>;
export type UpdateReportInput = z.input<typeof updateReportSchema>;
