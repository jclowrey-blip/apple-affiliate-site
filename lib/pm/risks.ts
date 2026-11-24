import { logActivity } from "./activity";
import { prisma } from "./db";
import { riskSeverity } from "./health";
import { fromDateString, toDateString } from "./dates";
import {
  PmNotFoundError,
  type DateString,
  type Level,
  type Risk,
  type RiskKind,
  type RiskStatus,
  type RiskWithProject,
} from "./types";

type RiskRow = {
  id: string;
  projectId: string;
  workstreamId: string | null;
  kind: string;
  title: string;
  description: string;
  mitigation: string;
  owner: string;
  likelihood: number;
  impact: number;
  status: string;
  dueDate: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

function toRisk(row: RiskRow): Risk {
  return {
    id: row.id,
    projectId: row.projectId,
    workstreamId: row.workstreamId,
    kind: row.kind as RiskKind,
    title: row.title,
    description: row.description,
    mitigation: row.mitigation,
    owner: row.owner,
    likelihood: row.likelihood as Level,
    impact: row.impact as Level,
    status: row.status as RiskStatus,
    dueDate: row.dueDate ? toDateString(row.dueDate) : null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

type RiskFields = {
  kind?: RiskKind;
  title?: string;
  description?: string;
  mitigation?: string;
  owner?: string;
  likelihood?: Level;
  impact?: Level;
  status?: RiskStatus;
  dueDate?: DateString | null;
  workstreamId?: string | null;
};

async function assertWorkstreamInProject(workstreamId: string, projectId: string) {
  const ws = await prisma.workstream.findUnique({ where: { id: workstreamId }, select: { projectId: true } });
  if (!ws || ws.projectId !== projectId) throw new PmNotFoundError("Workstream");
}

export async function listRisks(projectId: string): Promise<Risk[]> {
  const rows = await prisma.risk.findMany({ where: { projectId }, orderBy: [{ createdAt: "asc" }] });
  return rows.map(toRisk);
}

/** Risks and issues that are not closed, across every project. */
export async function listOpenRisks(): Promise<RiskWithProject[]> {
  const rows = await prisma.risk.findMany({
    where: { status: { not: "closed" } },
    include: { project: { select: { slug: true, name: true, color: true } } },
    orderBy: [{ createdAt: "asc" }],
  });
  return rows.map((row) => ({ ...toRisk(row), project: row.project }));
}

export async function createRisk(input: { projectId: string; title: string } & RiskFields): Promise<Risk> {
  const project = await prisma.project.findUnique({ where: { id: input.projectId }, select: { id: true } });
  if (!project) throw new PmNotFoundError("Project");
  if (input.workstreamId) await assertWorkstreamInProject(input.workstreamId, input.projectId);
  const created = toRisk(
    await prisma.risk.create({
      data: {
        projectId: input.projectId,
        title: input.title,
        kind: input.kind ?? "risk",
        description: input.description ?? "",
        mitigation: input.mitigation ?? "",
        owner: input.owner ?? "",
        likelihood: input.likelihood ?? 2,
        impact: input.impact ?? 2,
        status: input.status ?? "open",
        dueDate: input.dueDate ? fromDateString(input.dueDate) : null,
        workstreamId: input.workstreamId ?? null,
      },
    }),
  );
  await logActivity(input.projectId, `New ${created.kind} logged: ${created.title} (${riskSeverity(created)} severity)`);
  return created;
}

export async function updateRisk(id: string, patch: RiskFields): Promise<Risk> {
  const existing = await prisma.risk.findUnique({ where: { id } });
  if (!existing) throw new PmNotFoundError("Risk");
  if (patch.workstreamId) await assertWorkstreamInProject(patch.workstreamId, existing.projectId);
  const before = toRisk(existing);
  const { dueDate, ...rest } = patch;
  const after = toRisk(
    await prisma.risk.update({
      where: { id },
      data: { ...rest, dueDate: dueDate === undefined ? undefined : dueDate ? fromDateString(dueDate) : null },
    }),
  );
  const notes: string[] = [];
  if (after.status !== before.status) notes.push(`status ${before.status} to ${after.status}`);
  if (riskSeverity(after) !== riskSeverity(before)) notes.push(`severity ${riskSeverity(before)} to ${riskSeverity(after)}`);
  if (after.kind !== before.kind) notes.push(`now recorded as ${after.kind === "issue" ? "an issue" : "a risk"}`);
  if (after.owner !== before.owner) notes.push(`owner is now ${after.owner || "unassigned"}`);
  if (after.dueDate !== before.dueDate) notes.push(after.dueDate ? `due date ${after.dueDate}` : "due date cleared");
  if (notes.length) await logActivity(existing.projectId, `${after.kind === "issue" ? "Issue" : "Risk"} ${after.title}: ${notes.join("; ")}`);
  return after;
}

export async function deleteRisk(id: string): Promise<void> {
  const existing = await prisma.risk.findUnique({ where: { id }, select: { projectId: true, title: true } });
  if (!existing) throw new PmNotFoundError("Risk");
  await prisma.risk.delete({ where: { id } });
  await logActivity(existing.projectId, `Register entry deleted: ${existing.title}`);
}
