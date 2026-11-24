import { logActivity } from "./activity";
import { fromDateString, toDateString } from "./dates";
import { prisma } from "./db";
import { PmNotFoundError, type DateString, type Workstream } from "./types";

function toWorkstream(row: {
  id: string;
  projectId: string;
  name: string;
  description: string;
  owner: string;
  order: number;
  percentComplete: number;
  plannedStart: Date | null;
  plannedFinish: Date | null;
}): Workstream {
  return {
    id: row.id,
    projectId: row.projectId,
    name: row.name,
    description: row.description,
    owner: row.owner,
    order: row.order,
    percentComplete: row.percentComplete,
    plannedStart: row.plannedStart ? toDateString(row.plannedStart) : null,
    plannedFinish: row.plannedFinish ? toDateString(row.plannedFinish) : null,
  };
}

export async function listWorkstreams(projectId: string): Promise<Workstream[]> {
  const rows = await prisma.workstream.findMany({ where: { projectId }, orderBy: [{ order: "asc" }, { name: "asc" }] });
  return rows.map(toWorkstream);
}

export async function createWorkstream(input: {
  projectId: string;
  name: string;
  description?: string;
  owner?: string;
  percentComplete?: number;
  plannedStart?: DateString | null;
  plannedFinish?: DateString | null;
}): Promise<Workstream> {
  const project = await prisma.project.findUnique({ where: { id: input.projectId }, select: { id: true } });
  if (!project) throw new PmNotFoundError("Project");
  const last = await prisma.workstream.aggregate({ where: { projectId: input.projectId }, _max: { order: true } });
  const created = toWorkstream(
    await prisma.workstream.create({
      data: {
        projectId: input.projectId,
        name: input.name,
        description: input.description ?? "",
        owner: input.owner ?? "",
        percentComplete: input.percentComplete ?? 0,
        plannedStart: input.plannedStart ? fromDateString(input.plannedStart) : null,
        plannedFinish: input.plannedFinish ? fromDateString(input.plannedFinish) : null,
        order: (last._max.order ?? -1) + 1,
      },
    }),
  );
  await logActivity(input.projectId, `Workstream added: ${created.name}`);
  return created;
}

export async function updateWorkstream(
  id: string,
  patch: {
    name?: string;
    description?: string;
    owner?: string;
    percentComplete?: number;
    plannedStart?: DateString | null;
    plannedFinish?: DateString | null;
  },
): Promise<Workstream> {
  const existing = await prisma.workstream.findUnique({ where: { id } });
  if (!existing) throw new PmNotFoundError("Workstream");
  const date = (v: DateString | null | undefined) => (v === undefined ? undefined : v === null ? null : fromDateString(v));
  const updated = toWorkstream(
    await prisma.workstream.update({
      where: { id },
      data: {
        name: patch.name,
        description: patch.description,
        owner: patch.owner,
        percentComplete: patch.percentComplete,
        plannedStart: date(patch.plannedStart),
        plannedFinish: date(patch.plannedFinish),
      },
    }),
  );
  if (updated.percentComplete !== existing.percentComplete) {
    await logActivity(existing.projectId, `${updated.name}: progress ${existing.percentComplete}% to ${updated.percentComplete}%`);
  }
  if (updated.owner !== existing.owner) await logActivity(existing.projectId, `${updated.name}: owner is now ${updated.owner || "unassigned"}`);
  return updated;
}

/**
 * Deletes a workstream and its budget lines. Its milestones and risks are
 * kept and become unassigned.
 */
export async function deleteWorkstream(id: string): Promise<void> {
  const existing = await prisma.workstream.findUnique({ where: { id }, select: { projectId: true, name: true } });
  if (!existing) throw new PmNotFoundError("Workstream");
  await prisma.workstream.delete({ where: { id } });
  await logActivity(existing.projectId, `Workstream deleted: ${existing.name}`);
}
