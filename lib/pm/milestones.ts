import { logActivity } from "./activity";
import { prisma } from "./db";
import { diffDays, formatDate, fromDateString, toDateString } from "./dates";
import { PmNotFoundError, PmValidationError, type DateString, type Milestone } from "./types";

const milestoneInclude = { dependsOn: { select: { id: true } } };

type MilestoneRow = {
  id: string;
  projectId: string;
  workstreamId: string | null;
  name: string;
  targetDate: Date;
  baselineDate: Date | null;
  completedDate: Date | null;
  dependsOn: { id: string }[];
};

function toMilestone(row: MilestoneRow): Milestone {
  return {
    id: row.id,
    projectId: row.projectId,
    workstreamId: row.workstreamId,
    name: row.name,
    targetDate: toDateString(row.targetDate),
    // Milestones created before baselines existed use their target date.
    baselineDate: toDateString(row.baselineDate ?? row.targetDate),
    completedDate: row.completedDate ? toDateString(row.completedDate) : null,
    dependsOnIds: row.dependsOn.map((d) => d.id),
  };
}

async function assertWorkstreamInProject(workstreamId: string, projectId: string) {
  const ws = await prisma.workstream.findUnique({ where: { id: workstreamId }, select: { projectId: true } });
  if (!ws || ws.projectId !== projectId) throw new PmNotFoundError("Workstream");
}

/**
 * Checks a milestone's new dependency list: every dependency must be another
 * milestone in the same project, and the result must not form a loop.
 */
async function assertValidDependencies(milestoneId: string, projectId: string, dependsOnIds: string[]) {
  if (dependsOnIds.includes(milestoneId)) throw new PmValidationError("A milestone can't depend on itself.");
  const all = await prisma.milestone.findMany({ where: { projectId }, include: milestoneInclude });
  const byId = new Map(all.map((m) => [m.id, m.dependsOn.map((d) => d.id)]));
  for (const id of dependsOnIds) {
    if (!byId.has(id)) throw new PmNotFoundError("Milestone dependency");
  }
  // Walk upstream from the proposed dependencies; reaching this milestone means a loop.
  const seen = new Set<string>();
  const stack = [...dependsOnIds];
  while (stack.length) {
    const id = stack.pop()!;
    if (id === milestoneId) throw new PmValidationError("That dependency would create a loop between milestones.");
    if (seen.has(id)) continue;
    seen.add(id);
    stack.push(...(byId.get(id) ?? []));
  }
}

export async function listMilestones(projectId: string): Promise<Milestone[]> {
  const rows = await prisma.milestone.findMany({
    where: { projectId },
    include: milestoneInclude,
    orderBy: [{ targetDate: "asc" }, { name: "asc" }],
  });
  return rows.map(toMilestone);
}

/** Creates a milestone. Its baseline is the target date unless one is given. */
export async function createMilestone(input: {
  projectId: string;
  name: string;
  targetDate: DateString;
  baselineDate?: DateString;
  workstreamId?: string | null;
}): Promise<Milestone> {
  const project = await prisma.project.findUnique({ where: { id: input.projectId }, select: { id: true } });
  if (!project) throw new PmNotFoundError("Project");
  if (input.workstreamId) await assertWorkstreamInProject(input.workstreamId, input.projectId);
  const created = toMilestone(
    await prisma.milestone.create({
      data: {
        projectId: input.projectId,
        name: input.name,
        targetDate: fromDateString(input.targetDate),
        baselineDate: fromDateString(input.baselineDate ?? input.targetDate),
        workstreamId: input.workstreamId ?? null,
      },
      include: milestoneInclude,
    }),
  );
  await logActivity(input.projectId, `Milestone added: ${created.name}, target ${formatDate(created.targetDate, { year: true })}`);
  return created;
}

/**
 * Updates a milestone. Changing `targetDate` leaves the baseline alone, which
 * is what records slippage; pass `baselineDate` to re-baseline deliberately.
 */
export async function updateMilestone(
  id: string,
  patch: {
    name?: string;
    targetDate?: DateString;
    baselineDate?: DateString;
    completedDate?: DateString | null;
    workstreamId?: string | null;
    dependsOnIds?: string[];
  },
): Promise<Milestone> {
  const existing = await prisma.milestone.findUnique({ where: { id }, include: milestoneInclude });
  if (!existing) throw new PmNotFoundError("Milestone");
  const before = toMilestone(existing);
  if (patch.workstreamId) await assertWorkstreamInProject(patch.workstreamId, existing.projectId);
  if (patch.dependsOnIds) await assertValidDependencies(id, existing.projectId, patch.dependsOnIds);

  const date = (v: DateString | null | undefined) => (v === undefined ? undefined : v === null ? null : fromDateString(v));
  // Pin the old target as the baseline the first time a pre-baseline milestone moves.
  const pinBaseline = patch.targetDate && !patch.baselineDate && !existing.baselineDate ? existing.targetDate : undefined;
  const after = toMilestone(
    await prisma.milestone.update({
      where: { id },
      data: {
        name: patch.name,
        targetDate: date(patch.targetDate) ?? undefined,
        baselineDate: date(patch.baselineDate) ?? pinBaseline,
        completedDate: date(patch.completedDate),
        workstreamId: patch.workstreamId,
        dependsOn: patch.dependsOnIds ? { set: patch.dependsOnIds.map((d) => ({ id: d })) } : undefined,
      },
      include: milestoneInclude,
    }),
  );

  const day = (d: DateString) => formatDate(d, { year: true });
  const notes: string[] = [];
  if (after.targetDate !== before.targetDate) {
    const moved = diffDays(before.targetDate, after.targetDate);
    notes.push(`target moved from ${day(before.targetDate)} to ${day(after.targetDate)} (${Math.abs(moved)} days ${moved > 0 ? "later" : "earlier"})`);
  }
  if (after.completedDate && !before.completedDate) notes.push(`completed ${day(after.completedDate)}`);
  if (!after.completedDate && before.completedDate) notes.push("reopened");
  if (patch.baselineDate && after.baselineDate !== before.baselineDate) notes.push(`re-baselined to ${day(after.baselineDate)}`);
  if (patch.dependsOnIds && [...after.dependsOnIds].sort().join() !== [...before.dependsOnIds].sort().join()) notes.push("dependencies changed");
  if (notes.length) await logActivity(existing.projectId, `Milestone ${after.name}: ${notes.join("; ")}`);
  return after;
}

/** Deletes a milestone. Its tasks are kept and become unassigned. */
export async function deleteMilestone(id: string): Promise<void> {
  const existing = await prisma.milestone.findUnique({ where: { id }, select: { projectId: true, name: true } });
  if (!existing) throw new PmNotFoundError("Milestone");
  await prisma.milestone.delete({ where: { id } });
  await logActivity(existing.projectId, `Milestone deleted: ${existing.name}`);
}
