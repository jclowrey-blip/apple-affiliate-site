import { db } from "./db";
import { NotFoundError } from "./errors";
import { toSubtask } from "./mappers";
import type { CreateSubtaskInput, UpdateSubtaskInput } from "./schemas";
import type { Subtask } from "./types";

/** Adds a subtask at the end of the task's checklist. */
export async function createSubtask({ taskId, title }: CreateSubtaskInput): Promise<Subtask> {
  return db.$transaction(async (tx) => {
    const task = await tx.task.findUnique({ where: { id: taskId }, select: { id: true } });
    if (!task) throw new NotFoundError("Task");
    const { _max } = await tx.subtask.aggregate({ where: { taskId }, _max: { position: true } });
    const position = _max.position === null ? 0 : _max.position + 1;
    return toSubtask(await tx.subtask.create({ data: { taskId, title, position } }));
  });
}

export async function updateSubtask({ id, ...patch }: UpdateSubtaskInput): Promise<Subtask> {
  const existing = await db.subtask.findUnique({ where: { id }, select: { id: true } });
  if (!existing) throw new NotFoundError("Subtask");
  return toSubtask(await db.subtask.update({ where: { id }, data: patch }));
}

export async function deleteSubtask(id: string): Promise<void> {
  const { count } = await db.subtask.deleteMany({ where: { id } });
  if (count === 0) throw new NotFoundError("Subtask");
}
