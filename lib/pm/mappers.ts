// Prisma rows -> domain types. Keeps Prisma types from leaking out of lib/pm/.
import type { Prisma } from "@prisma/client";
import type { Milestone, Priority, Project, ProjectRef, ProjectStatus, Subtask, Task, TaskStatus, TaskWithProject } from "./types";

export const taskInclude = {
  labels: { select: { name: true }, orderBy: { name: "asc" } },
  subtasks: { orderBy: [{ position: "asc" }, { id: "asc" }] },
} satisfies Prisma.TaskInclude;

export const projectRefSelect = { id: true, slug: true, name: true, color: true } satisfies Prisma.ProjectSelect;

type TaskRow = Prisma.TaskGetPayload<{ include: typeof taskInclude }>;
type ProjectRow = Prisma.ProjectGetPayload<object>;
type MilestoneRow = Prisma.MilestoneGetPayload<object>;
type SubtaskRow = Prisma.SubtaskGetPayload<object>;

export function toProject(row: ProjectRow): Project {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    description: row.description,
    color: row.color,
    status: row.status as ProjectStatus,
    createdAt: row.createdAt.toISOString(),
  };
}

export function toMilestone(row: MilestoneRow): Milestone {
  return { id: row.id, projectId: row.projectId, name: row.name, targetDate: row.targetDate };
}

export function toSubtask(row: SubtaskRow): Subtask {
  return { id: row.id, taskId: row.taskId, title: row.title, done: row.done, position: row.position };
}

export function toTask(row: TaskRow): Task {
  return {
    id: row.id,
    projectId: row.projectId,
    milestoneId: row.milestoneId,
    title: row.title,
    description: row.description,
    status: row.status as TaskStatus,
    priority: row.priority as Priority,
    dueDate: row.dueDate,
    position: row.position,
    labels: row.labels.map((l) => l.name),
    subtasks: row.subtasks.map(toSubtask),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function toTaskWithProject(row: TaskRow & { project: ProjectRef }): TaskWithProject {
  return { ...toTask(row), project: row.project };
}
