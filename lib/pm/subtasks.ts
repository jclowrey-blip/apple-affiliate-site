import { prisma } from "./db";
import { PmNotFoundError, type Subtask } from "./types";

function toSubtask(row: { id: string; taskId: string; title: string; done: boolean; order: number }): Subtask {
  return { id: row.id, taskId: row.taskId, title: row.title, done: row.done, order: row.order };
}

/** Adds a subtask at the end of the task's list. */
export async function createSubtask(taskId: string, title: string): Promise<Subtask> {
  const task = await prisma.task.findUnique({ where: { id: taskId }, select: { id: true } });
  if (!task) throw new PmNotFoundError("Task");
  const last = await prisma.subtask.aggregate({ where: { taskId }, _max: { order: true } });
  return toSubtask(await prisma.subtask.create({ data: { taskId, title, order: (last._max.order ?? -1) + 1 } }));
}

export async function updateSubtask(id: string, patch: { title?: string; done?: boolean }): Promise<Subtask> {
  const existing = await prisma.subtask.findUnique({ where: { id }, select: { id: true } });
  if (!existing) throw new PmNotFoundError("Subtask");
  return toSubtask(await prisma.subtask.update({ where: { id }, data: patch }));
}

export async function deleteSubtask(id: string): Promise<void> {
  const existing = await prisma.subtask.findUnique({ where: { id }, select: { id: true } });
  if (!existing) throw new PmNotFoundError("Subtask");
  await prisma.subtask.delete({ where: { id } });
}
