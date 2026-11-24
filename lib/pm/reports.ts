import { prisma } from "./db";
import { fromDateString, toDateString } from "./dates";
import { PmNotFoundError, type DateString, type StatusReport } from "./types";

function toReport(row: {
  id: string;
  projectId: string;
  title: string;
  periodStart: Date;
  periodEnd: Date;
  body: string;
  source: string;
  createdAt: Date;
}): StatusReport {
  return {
    id: row.id,
    projectId: row.projectId,
    title: row.title,
    periodStart: toDateString(row.periodStart),
    periodEnd: toDateString(row.periodEnd),
    body: row.body,
    source: row.source === "assistant" ? "assistant" : "generated",
    createdAt: row.createdAt.toISOString(),
  };
}

/** Saved status reports for a project, newest first. */
export async function listReports(projectId: string): Promise<StatusReport[]> {
  const rows = await prisma.statusReport.findMany({ where: { projectId }, orderBy: { createdAt: "desc" } });
  return rows.map(toReport);
}

export async function getReport(id: string): Promise<StatusReport | null> {
  const row = await prisma.statusReport.findUnique({ where: { id } });
  return row ? toReport(row) : null;
}

export async function createReport(input: {
  projectId: string;
  title: string;
  periodStart: DateString;
  periodEnd: DateString;
  body: string;
  source?: "generated" | "assistant";
}): Promise<StatusReport> {
  const project = await prisma.project.findUnique({ where: { id: input.projectId }, select: { id: true } });
  if (!project) throw new PmNotFoundError("Project");
  return toReport(
    await prisma.statusReport.create({
      data: {
        projectId: input.projectId,
        title: input.title,
        periodStart: fromDateString(input.periodStart),
        periodEnd: fromDateString(input.periodEnd),
        body: input.body,
        source: input.source ?? "generated",
      },
    }),
  );
}

export async function updateReport(id: string, patch: { title?: string; body?: string }): Promise<StatusReport> {
  const existing = await prisma.statusReport.findUnique({ where: { id }, select: { id: true } });
  if (!existing) throw new PmNotFoundError("Report");
  return toReport(await prisma.statusReport.update({ where: { id }, data: patch }));
}

export async function deleteReport(id: string): Promise<void> {
  const existing = await prisma.statusReport.findUnique({ where: { id }, select: { id: true } });
  if (!existing) throw new PmNotFoundError("Report");
  await prisma.statusReport.delete({ where: { id } });
}
