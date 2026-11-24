import { logActivity } from "./activity";
import { prisma } from "./db";
import { fromDateString, toDateString } from "./dates";
import { changedPositions, moveItem } from "./reorder";
import {
  PmNotFoundError,
  type DateString,
  type Priority,
  type Task,
  type TaskStatus,
  type TaskWithProject,
} from "./types";

const taskInclude = {
  labels: { select: { name: true }, orderBy: { name: "asc" as const } },
  subtasks: { orderBy: { order: "asc" as const } },
};

type TaskRow = {
  id: string;
  projectId: string;
  milestoneId: string | null;
  title: string;
  description: string;
  status: string;
  priority: string;
  dueDate: Date | null;
  order: number;
  createdAt: Date;
  updatedAt: Date;
  labels: { name: string }[];
  subtasks: { id: string; taskId: string; title: string; done: boolean; order: number }[];
};

export function toTask(row: TaskRow): Task {
  return {
    id: row.id,
    projectId: row.projectId,
    milestoneId: row.milestoneId,
    title: row.title,
    description: row.description,
    status: row.status as TaskStatus,
    priority: row.priority as Priority,
    dueDate: row.dueDate ? toDateString(row.dueDate) : null,
    order: row.order,
    labels: row.labels.map((l) => l.name),
    subtasks: row.subtasks.map((s) => ({ id: s.id, taskId: s.taskId, title: s.title, done: s.done, order: s.order })),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function labelWrites(names: string[]) {
  return names.map((name) => ({ where: { name }, create: { name } }));
}

async function assertMilestoneInProject(milestoneId: string, projectId: string) {
  const milestone = await prisma.milestone.findUnique({ where: { id: milestoneId }, select: { projectId: true } });
  if (!milestone || milestone.projectId !== projectId) throw new PmNotFoundError("Milestone");
}

/** All tasks in a project, ordered by status column position. */
export async function listTasks(projectId: string): Promise<Task[]> {
  const rows = await prisma.task.findMany({
    where: { projectId },
    include: taskInclude,
    orderBy: [{ order: "asc" }, { createdAt: "asc" }],
  });
  return rows.map(toTask);
}

export async function getTask(id: string): Promise<TaskWithProject | null> {
  const row = await prisma.task.findUnique({
    where: { id },
    include: { ...taskInclude, project: { select: { slug: true, name: true, color: true } } },
  });
  return row ? { ...toTask(row), project: row.project } : null;
}

/** Creates a task at the end of its status column. */
export async function createTask(input: {
  projectId: string;
  title: string;
  description?: string;
  status?: TaskStatus;
  priority?: Priority;
  dueDate?: DateString | null;
  labels?: string[];
  milestoneId?: string | null;
}): Promise<Task> {
  const project = await prisma.project.findUnique({ where: { id: input.projectId }, select: { id: true } });
  if (!project) throw new PmNotFoundError("Project");
  if (input.milestoneId) await assertMilestoneInProject(input.milestoneId, input.projectId);

  const status = input.status ?? "backlog";
  const last = await prisma.task.aggregate({ where: { projectId: input.projectId, status }, _max: { order: true } });
  const row = await prisma.task.create({
    data: {
      projectId: input.projectId,
      title: input.title,
      description: input.description ?? "",
      status,
      priority: input.priority ?? "medium",
      dueDate: input.dueDate ? fromDateString(input.dueDate) : null,
      order: (last._max.order ?? -1) + 1,
      milestoneId: input.milestoneId ?? null,
      labels: { connectOrCreate: labelWrites(input.labels ?? []) },
    },
    include: taskInclude,
  });
  return toTask(row);
}

/**
 * Updates task fields. Changing `status` here (as opposed to moveTask) puts
 * the task at the end of the new column.
 */
export async function updateTask(
  id: string,
  patch: {
    title?: string;
    description?: string;
    status?: TaskStatus;
    priority?: Priority;
    dueDate?: DateString | null;
    labels?: string[];
    milestoneId?: string | null;
  },
): Promise<Task> {
  const existing = await prisma.task.findUnique({ where: { id }, select: { projectId: true, status: true } });
  if (!existing) throw new PmNotFoundError("Task");
  if (patch.milestoneId) await assertMilestoneInProject(patch.milestoneId, existing.projectId);

  if (patch.status !== undefined && patch.status !== existing.status) {
    await moveTask(id, patch.status, Number.MAX_SAFE_INTEGER);
  }

  const row = await prisma.task.update({
    where: { id },
    data: {
      title: patch.title,
      description: patch.description,
      priority: patch.priority,
      dueDate: patch.dueDate === undefined ? undefined : patch.dueDate ? fromDateString(patch.dueDate) : null,
      milestoneId: patch.milestoneId,
      labels: patch.labels ? { set: [], connectOrCreate: labelWrites(patch.labels) } : undefined,
    },
    include: taskInclude,
  });
  if (patch.labels) await prisma.label.deleteMany({ where: { tasks: { none: {} } } });
  return toTask(row);
}

/**
 * Moves a task to `index` within the `status` column of its project and
 * renumbers the affected columns, all in one transaction.
 */
export async function moveTask(id: string, status: TaskStatus, index: number): Promise<Task> {
  return prisma.$transaction(async (tx) => {
    const task = await tx.task.findUnique({ where: { id }, select: { projectId: true } });
    if (!task) throw new PmNotFoundError("Task");

    const rows = await tx.task.findMany({
      where: { projectId: task.projectId },
      select: { id: true, status: true, order: true },
      orderBy: [{ order: "asc" }, { createdAt: "asc" }],
    });
    const before = rows.map((r) => ({ id: r.id, status: r.status as TaskStatus, order: r.order }));
    const changes = changedPositions(before, moveItem(before, id, status, index));
    for (const change of changes) {
      await tx.task.update({ where: { id: change.id }, data: { status: change.status, order: change.order } });
    }
    const row = await tx.task.findUniqueOrThrow({ where: { id }, include: taskInclude });
    return { moved: toTask(row), wasDone: before.find((r) => r.id === id)?.status === "done" };
  }).then(async ({ moved, wasDone }) => {
    if (moved.status === "done" && !wasDone) await logActivity(moved.projectId, `Task done: ${moved.title}`);
    return moved;
  });
}

export async function deleteTask(id: string): Promise<void> {
  const existing = await prisma.task.findUnique({ where: { id }, select: { id: true } });
  if (!existing) throw new PmNotFoundError("Task");
  await prisma.task.delete({ where: { id } });
  await prisma.label.deleteMany({ where: { tasks: { none: {} } } });
}

/** Unfinished tasks across all projects due on or before the given date, soonest first. */
export async function listOpenTasksDueBy(date: DateString): Promise<TaskWithProject[]> {
  const rows = await prisma.task.findMany({
    where: { status: { not: "done" }, dueDate: { lte: fromDateString(date) } },
    include: { ...taskInclude, project: { select: { slug: true, name: true, color: true } } },
    orderBy: [{ dueDate: "asc" }, { createdAt: "asc" }],
  });
  return rows.map((row) => ({ ...toTask(row), project: row.project }));
}
