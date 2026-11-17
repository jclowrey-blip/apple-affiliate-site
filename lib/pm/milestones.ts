import { prisma } from "./db";
import { fromDateString, toDateString } from "./dates";
import { PmNotFoundError, type DateString, type Milestone } from "./types";

function toMilestone(row: { id: string; projectId: string; name: string; targetDate: Date }): Milestone {
  return { id: row.id, projectId: row.projectId, name: row.name, targetDate: toDateString(row.targetDate) };
}

export async function listMilestones(projectId: string): Promise<Milestone[]> {
  const rows = await prisma.milestone.findMany({ where: { projectId }, orderBy: [{ targetDate: "asc" }, { name: "asc" }] });
  return rows.map(toMilestone);
}

export async function createMilestone(input: {
  projectId: string;
  name: string;
  targetDate: DateString;
}): Promise<Milestone> {
  const project = await prisma.project.findUnique({ where: { id: input.projectId }, select: { id: true } });
  if (!project) throw new PmNotFoundError("Project");
  return toMilestone(
    await prisma.milestone.create({
      data: { projectId: input.projectId, name: input.name, targetDate: fromDateString(input.targetDate) },
    }),
  );
}

export async function updateMilestone(
  id: string,
  patch: { name?: string; targetDate?: DateString },
): Promise<Milestone> {
  const existing = await prisma.milestone.findUnique({ where: { id }, select: { id: true } });
  if (!existing) throw new PmNotFoundError("Milestone");
  return toMilestone(
    await prisma.milestone.update({
      where: { id },
      data: { name: patch.name, targetDate: patch.targetDate ? fromDateString(patch.targetDate) : undefined },
    }),
  );
}

/** Deletes a milestone. Its tasks are kept and become unassigned. */
export async function deleteMilestone(id: string): Promise<void> {
  const existing = await prisma.milestone.findUnique({ where: { id }, select: { id: true } });
  if (!existing) throw new PmNotFoundError("Milestone");
  await prisma.milestone.delete({ where: { id } });
}
