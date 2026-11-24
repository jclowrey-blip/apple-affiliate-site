import { db } from "./db";
import { NotFoundError } from "./errors";
import { toMilestone } from "./mappers";
import type { CreateMilestoneInput, UpdateMilestoneInput } from "./schemas";
import type { Milestone } from "./types";

export async function listMilestones(projectId: string): Promise<Milestone[]> {
  const rows = await db.milestone.findMany({
    where: { projectId },
    orderBy: [{ targetDate: "asc" }, { name: "asc" }],
  });
  return rows.map(toMilestone);
}

export async function createMilestone(input: CreateMilestoneInput): Promise<Milestone> {
  const project = await db.project.findUnique({ where: { id: input.projectId }, select: { id: true } });
  if (!project) throw new NotFoundError("Project");
  return toMilestone(await db.milestone.create({ data: input }));
}

export async function updateMilestone({ id, ...patch }: UpdateMilestoneInput): Promise<Milestone> {
  const existing = await db.milestone.findUnique({ where: { id }, select: { id: true } });
  if (!existing) throw new NotFoundError("Milestone");
  return toMilestone(await db.milestone.update({ where: { id }, data: patch }));
}

/** Deletes a milestone. Its tasks are kept and become unassigned. */
export async function deleteMilestone(id: string): Promise<void> {
  const { count } = await db.milestone.deleteMany({ where: { id } });
  if (count === 0) throw new NotFoundError("Milestone");
}
