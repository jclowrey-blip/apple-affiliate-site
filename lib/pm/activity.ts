import { prisma } from "./db";
import type { Activity } from "./types";

function toActivity(row: { id: string; projectId: string; kind: string; summary: string; at: Date }): Activity {
  return { id: row.id, projectId: row.projectId, kind: row.kind === "note" ? "note" : "change", summary: row.summary, at: row.at.toISOString() };
}

/**
 * Records that something changed (or a note the user made). The data-access
 * functions call this themselves, so changes made from the UI, the daily
 * check-in, an import or the assistant all end up in the same log.
 */
export async function logActivity(projectId: string, summary: string, kind: "change" | "note" = "change"): Promise<void> {
  await prisma.activity.create({ data: { projectId, summary: summary.slice(0, 2000), kind } });
}

/** A project's activity from `since` onward, oldest first. */
export async function listActivity(projectId: string, since: Date, limit = 500): Promise<Activity[]> {
  const rows = await prisma.activity.findMany({ where: { projectId, at: { gte: since } }, orderBy: { at: "asc" }, take: limit });
  return rows.map(toActivity);
}
