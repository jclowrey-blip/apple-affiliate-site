import { prisma } from "./db";
import { PmNotFoundError, type TeamMember } from "./types";

function toMember(row: { id: string; projectId: string; workstreamId: string | null; name: string; role: string; email: string }): TeamMember {
  return { id: row.id, projectId: row.projectId, workstreamId: row.workstreamId, name: row.name, role: row.role, email: row.email };
}

async function assertWorkstreamInProject(workstreamId: string, projectId: string) {
  const ws = await prisma.workstream.findUnique({ where: { id: workstreamId }, select: { projectId: true } });
  if (!ws || ws.projectId !== projectId) throw new PmNotFoundError("Workstream");
}

export async function listMembers(projectId: string): Promise<TeamMember[]> {
  const rows = await prisma.teamMember.findMany({ where: { projectId }, orderBy: [{ createdAt: "asc" }] });
  return rows.map(toMember);
}

export async function createMember(input: {
  projectId: string;
  name: string;
  role?: string;
  email?: string;
  workstreamId?: string | null;
}): Promise<TeamMember> {
  const project = await prisma.project.findUnique({ where: { id: input.projectId }, select: { id: true } });
  if (!project) throw new PmNotFoundError("Project");
  if (input.workstreamId) await assertWorkstreamInProject(input.workstreamId, input.projectId);
  return toMember(
    await prisma.teamMember.create({
      data: { projectId: input.projectId, name: input.name, role: input.role ?? "", email: input.email ?? "", workstreamId: input.workstreamId ?? null },
    }),
  );
}

export async function updateMember(
  id: string,
  patch: { name?: string; role?: string; email?: string; workstreamId?: string | null },
): Promise<TeamMember> {
  const existing = await prisma.teamMember.findUnique({ where: { id }, select: { projectId: true } });
  if (!existing) throw new PmNotFoundError("Team member");
  if (patch.workstreamId) await assertWorkstreamInProject(patch.workstreamId, existing.projectId);
  return toMember(await prisma.teamMember.update({ where: { id }, data: patch }));
}

/** Removes a team member. Messages already drafted to them are kept. */
export async function deleteMember(id: string): Promise<void> {
  const existing = await prisma.teamMember.findUnique({ where: { id }, select: { id: true } });
  if (!existing) throw new PmNotFoundError("Team member");
  await prisma.teamMember.delete({ where: { id } });
}
