import type { Prisma } from "@prisma/client";
import { db } from "./db";
import { NotFoundError, PmError } from "./errors";
import { projectRefSelect, taskInclude, toTask, toTaskWithProject } from "./mappers";
import { applyMove, changedPlacements } from "./ordering";
import type { CreateTaskInput, MoveTaskInput, UpdateTaskInput } from "./schemas";
import type { Task, TaskStatus, TaskWithProject } from "./types";

type Tx = Prisma.TransactionClient;

const withProject = { ...taskInclude, project: { select: projectRefSelect } } satisfies Prisma.TaskInclude;
const boardOrder = [{ position: "asc" }, { id: "asc" }] satisfies Prisma.TaskOrderByWithRelationInput[];

async function nextPosition(tx: Tx, projectId: string, status: TaskStatus): Promise<number> {
  const { _max } = await tx.task.aggregate({ where: { projectId, status }, _max: { position: true } });
  return _max.position === null ? 0 : _max.position + 1;
}

async function assertMilestoneInProject(tx: Tx, milestoneId: string, projectId: string) {
  const milestone = await tx.milestone.findUnique({ where: { id: milestoneId }, select: { projectId: true } });
  if (!milestone || milestone.projectId !== projectId) {
    throw new PmError("That milestone does not belong to this project");
  }
}

function labelConnections(projectId: string, names: string[]) {
  return names.map((name) => ({
    where: { projectId_name: { projectId, name } },
    create: { projectId, name },
  }));
}

/** All tasks of a project, in board order within each status. */
export async function listTasks(projectId: string): Promise<Task[]> {
  const rows = await db.task.findMany({ where: { projectId }, include: taskInclude, orderBy: boardOrder });
  return rows.map(toTask);
}

export async function getTask(id: string): Promise<TaskWithProject | null> {
  const row = await db.task.findUnique({ where: { id }, include: withProject });
  return row ? toTaskWithProject(row) : null;
}

/** Unfinished tasks due before `today`, oldest first, across all projects. */
export async function listOverdueTasks(today: string): Promise<TaskWithProject[]> {
  const rows = await db.task.findMany({
    where: { status: { not: "done" }, dueDate: { lt: today } },
    include: withProject,
    orderBy: [{ dueDate: "asc" }, { id: "asc" }],
  });
  return rows.map(toTaskWithProject);
}

/** Unfinished tasks due from `from` to `to` inclusive, soonest first, across all projects. */
export async function listTasksDueBetween(from: string, to: string): Promise<TaskWithProject[]> {
  const rows = await db.task.findMany({
    where: { status: { not: "done" }, dueDate: { gte: from, lte: to } },
    include: withProject,
    orderBy: [{ dueDate: "asc" }, { id: "asc" }],
  });
  return rows.map(toTaskWithProject);
}

/** Label names in use in a project, alphabetically. */
export async function listLabels(projectId: string): Promise<string[]> {
  const rows = await db.label.findMany({ where: { projectId }, select: { name: true }, orderBy: { name: "asc" } });
  return rows.map((l) => l.name);
}

/** Creates a task at the bottom of its status column. */
export async function createTask(input: CreateTaskInput): Promise<Task> {
  return db.$transaction(async (tx) => {
    const project = await tx.project.findUnique({ where: { id: input.projectId }, select: { id: true } });
    if (!project) throw new NotFoundError("Project");
    if (input.milestoneId) await assertMilestoneInProject(tx, input.milestoneId, input.projectId);

    const row = await tx.task.create({
      data: {
        projectId: input.projectId,
        title: input.title,
        description: input.description,
        status: input.status,
        priority: input.priority,
        dueDate: input.dueDate,
        milestoneId: input.milestoneId,
        position: await nextPosition(tx, input.projectId, input.status),
        labels: { connectOrCreate: labelConnections(input.projectId, input.labels) },
      },
      include: taskInclude,
    });
    return toTask(row);
  });
}

/**
 * Updates any subset of a task's fields. Changing the status moves the task to
 * the bottom of the new column; `labels` replaces the task's whole label set.
 */
export async function updateTask({ id, labels, ...patch }: UpdateTaskInput): Promise<Task> {
  return db.$transaction(async (tx) => {
    const existing = await tx.task.findUnique({ where: { id }, select: { projectId: true, status: true } });
    if (!existing) throw new NotFoundError("Task");
    if (patch.milestoneId) await assertMilestoneInProject(tx, patch.milestoneId, existing.projectId);

    const data: Prisma.TaskUncheckedUpdateInput = { ...patch };
    if (patch.status && patch.status !== existing.status) {
      data.position = await nextPosition(tx, existing.projectId, patch.status);
    }
    if (labels) {
      data.labels = { set: [], connectOrCreate: labelConnections(existing.projectId, labels) };
    }

    const row = await tx.task.update({ where: { id }, data, include: taskInclude });
    if (labels) await pruneLabels(tx, existing.projectId);
    return toTask(row);
  });
}

/**
 * Moves a task to `index` within the `status` column (drag and drop) and
 * renumbers the affected columns. Returns the placements that changed.
 */
export async function moveTask({ id, status, index }: MoveTaskInput) {
  return db.$transaction(async (tx) => {
    const task = await tx.task.findUnique({ where: { id }, select: { projectId: true } });
    if (!task) throw new NotFoundError("Task");

    const rows = await tx.task.findMany({
      where: { projectId: task.projectId },
      select: { id: true, status: true, position: true },
    });
    const before = rows.map((r) => ({ ...r, status: r.status as TaskStatus }));
    const changed = changedPlacements(before, applyMove(before, id, status, index));
    for (const c of changed) {
      await tx.task.update({ where: { id: c.id }, data: { status: c.status, position: c.position } });
    }
    return changed;
  });
}

export async function deleteTask(id: string): Promise<void> {
  await db.$transaction(async (tx) => {
    const task = await tx.task.findUnique({ where: { id }, select: { projectId: true } });
    if (!task) throw new NotFoundError("Task");
    await tx.task.delete({ where: { id } });
    await pruneLabels(tx, task.projectId);
  });
}

/** Removes labels no task uses any more, so filter menus only list live labels. */
async function pruneLabels(tx: Tx, projectId: string) {
  await tx.label.deleteMany({ where: { projectId, tasks: { none: {} } } });
}
