import { prisma } from "./db";
import { PmNotFoundError, type Workstream } from "./types";

function toWorkstream(row: {
  id: string;
  projectId: string;
  name: string;
  description: string;
  owner: string;
  order: number;
}): Workstream {
  return {
    id: row.id,
    projectId: row.projectId,
    name: row.name,
    description: row.description,
    owner: row.owner,
    order: row.order,
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
}): Promise<Workstream> {
  const project = await prisma.project.findUnique({ where: { id: input.projectId }, select: { id: true } });
  if (!project) throw new PmNotFoundError("Project");
  const last = await prisma.workstream.aggregate({ where: { projectId: input.projectId }, _max: { order: true } });
  return toWorkstream(
    await prisma.workstream.create({
      data: {
        projectId: input.projectId,
        name: input.name,
        description: input.description ?? "",
        owner: input.owner ?? "",
        order: (last._max.order ?? -1) + 1,
      },
    }),
  );
}

export async function updateWorkstream(
  id: string,
  patch: { name?: string; description?: string; owner?: string },
): Promise<Workstream> {
  const existing = await prisma.workstream.findUnique({ where: { id }, select: { id: true } });
  if (!existing) throw new PmNotFoundError("Workstream");
  return toWorkstream(await prisma.workstream.update({ where: { id }, data: patch }));
}

/**
 * Deletes a workstream and its budget lines. Its milestones and risks are
 * kept and become unassigned.
 */
export async function deleteWorkstream(id: string): Promise<void> {
  const existing = await prisma.workstream.findUnique({ where: { id }, select: { id: true } });
  if (!existing) throw new PmNotFoundError("Workstream");
  await prisma.workstream.delete({ where: { id } });
}
