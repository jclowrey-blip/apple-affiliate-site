// Applies a parsed CSV import to a project, and builds the matching exports.
// Imports never delete: rows are matched to existing records and updated,
// and anything not matched is created.
import * as budget from "./budget";
import { listBudgetLines } from "./budget";
import { toCsv } from "./csv";
import { todayString } from "./dates";
import { ENTITIES, readImport, type ColumnMapping, type EntityKey, type ImportIssue } from "./interchange";
import * as milestones from "./milestones";
import * as risks from "./risks";
import * as team from "./team";
import { LEVEL_LABELS, RISK_KIND_LABELS, RISK_STATUS_LABELS, type Project, type Workstream } from "./types";
import { createWorkstream, listWorkstreams } from "./workstreams";

export type ImportOutcome = {
  entity: EntityKey;
  rowCount: number;
  created: number;
  updated: number;
  workstreamsCreated: string[];
  /** Rows left out, with the reason. */
  issues: ImportIssue[];
  /** Things imported with a caveat (for example an unknown dependency name). */
  warnings: string[];
  /** True when nothing was written (a preview). */
  dryRun: boolean;
  headers: string[];
  mapping: ColumnMapping;
};

const key = (text: string) => text.trim().toLowerCase();

export async function importCsv(project: Project, entity: EntityKey, csv: string, opts: { mapping?: ColumnMapping; dryRun?: boolean } = {}): Promise<ImportOutcome> {
  const dryRun = opts.dryRun ?? false;
  const read = readImport(entity, csv, opts.mapping);
  const outcome: ImportOutcome = { entity, rowCount: read.rowCount, created: 0, updated: 0, workstreamsCreated: [], issues: read.issues, warnings: [], dryRun, headers: read.headers, mapping: read.mapping };

  const workstreams = new Map<string, Workstream | null>((await listWorkstreams(project.id)).map((w) => [key(w.name), w]));
  /** Finds a workstream by name, creating it if needed. Returns undefined when no name was given. */
  const workstreamFor = async (name: string | undefined): Promise<Workstream | null | undefined> => {
    if (!name) return undefined;
    const k = key(name);
    if (!workstreams.has(k)) {
      outcome.workstreamsCreated.push(name.trim());
      workstreams.set(k, dryRun ? null : await createWorkstream({ projectId: project.id, name: name.trim().slice(0, 80) }));
    }
    return workstreams.get(k);
  };

  if (entity === "milestones") {
    const items = (read as ReturnType<typeof readImport<"milestones">>).items;
    const existing = new Map((await milestones.listMilestones(project.id)).map((m) => [key(m.name), m]));
    const ids = new Map([...existing].map(([k, m]) => [k, m.id]));
    for (const item of items) {
      const ws = await workstreamFor(item.workstream);
      const completedDate = item.completedDate ?? (item.done ? todayString() : undefined);
      const found = existing.get(key(item.name));
      if (found) outcome.updated++;
      else outcome.created++;
      if (dryRun) {
        ids.set(key(item.name), found?.id ?? `new:${key(item.name)}`);
        continue;
      }
      if (found) {
        await milestones.updateMilestone(found.id, { targetDate: item.targetDate, baselineDate: item.baselineDate, completedDate, workstreamId: ws === undefined ? undefined : (ws?.id ?? null) });
      } else {
        const created = await milestones.createMilestone({ projectId: project.id, name: item.name.slice(0, 80), targetDate: item.targetDate, baselineDate: item.baselineDate, workstreamId: ws?.id ?? null });
        if (completedDate) await milestones.updateMilestone(created.id, { completedDate });
        ids.set(key(item.name), created.id);
      }
    }
    // Dependencies second, once every milestone in the file exists.
    for (const item of items) {
      if (!item.dependsOn.length) continue;
      const known = item.dependsOn.filter((d) => ids.has(key(d)));
      const unknown = item.dependsOn.filter((d) => !ids.has(key(d)));
      if (unknown.length) outcome.warnings.push(`Line ${item.line}: "${item.name}" depends on ${unknown.map((u) => `"${u}"`).join(", ")}, which isn't a milestone in this project or file. That link was skipped.`);
      if (dryRun || !known.length) continue;
      try {
        await milestones.updateMilestone(ids.get(key(item.name))!, { dependsOnIds: Array.from(new Set(known.map((d) => ids.get(key(d))!))) });
      } catch (error) {
        outcome.warnings.push(`Line ${item.line}: dependencies for "${item.name}" were skipped (${error instanceof Error ? error.message : "invalid"}).`);
      }
    }
  } else if (entity === "budget") {
    const items = (read as ReturnType<typeof readImport<"budget">>).items;
    const lines = await listBudgetLines(project.id);
    for (const item of items) {
      const ws = await workstreamFor(item.workstream);
      const found = ws ? lines.find((l) => l.workstreamId === ws.id && key(l.name) === key(item.name)) : undefined;
      if (found) outcome.updated++;
      else outcome.created++;
      if (dryRun) continue;
      const amounts = { budget: item.budget, committed: item.committed, spent: item.spent, forecast: item.forecast };
      if (found) await budget.updateBudgetLine(found.id, amounts);
      else lines.push(await budget.createBudgetLine({ workstreamId: ws!.id, name: item.name.slice(0, 80), ...amounts }));
    }
  } else if (entity === "risks") {
    const items = (read as ReturnType<typeof readImport<"risks">>).items;
    const existing = new Map((await risks.listRisks(project.id)).map((r) => [key(r.title), r]));
    for (const item of items) {
      const ws = await workstreamFor(item.workstream);
      const found = existing.get(key(item.title));
      if (found) outcome.updated++;
      else outcome.created++;
      if (dryRun) continue;
      const { title, workstream: _workstream, line: _line, ...fields } = item;
      const patch = { ...fields, workstreamId: ws === undefined ? undefined : (ws?.id ?? null) };
      if (found) await risks.updateRisk(found.id, patch);
      else existing.set(key(title), await risks.createRisk({ projectId: project.id, title: title.slice(0, 200), ...patch }));
    }
  } else {
    const items = (read as ReturnType<typeof readImport<"team">>).items;
    const members = await team.listMembers(project.id);
    for (const item of items) {
      const ws = await workstreamFor(item.workstream);
      const found = members.find((m) => (item.email && m.email ? key(m.email) === key(item.email) : key(m.name) === key(item.name)));
      if (found) outcome.updated++;
      else outcome.created++;
      if (dryRun) continue;
      const fields = { name: item.name.slice(0, 80), role: item.role, email: item.email, workstreamId: ws === undefined ? undefined : (ws?.id ?? null) };
      if (found) await team.updateMember(found.id, fields);
      else members.push(await team.createMember({ projectId: project.id, ...fields }));
    }
  }

  return outcome;
}

/** A project's records of one kind as CSV, using the same column names the import reads. */
export async function exportCsv(project: Project, entity: EntityKey): Promise<string> {
  const header = ENTITIES[entity].fields.map((f) => f.label);
  const workstreams = await listWorkstreams(project.id);
  const wsName = (id: string | null) => workstreams.find((w) => w.id === id)?.name ?? "";

  if (entity === "milestones") {
    const all = await milestones.listMilestones(project.id);
    const name = (id: string) => all.find((m) => m.id === id)?.name ?? "";
    return toCsv([header, ...all.map((m) => [m.name, m.targetDate, m.baselineDate, m.completedDate ?? "", m.completedDate ? "Done" : "Open", wsName(m.workstreamId), m.dependsOnIds.map(name).filter(Boolean).join("; ")])]);
  }
  if (entity === "budget") {
    return toCsv([header, ...(await listBudgetLines(project.id)).map((l) => [wsName(l.workstreamId), l.name, l.budget, l.committed, l.spent, l.forecast])]);
  }
  if (entity === "risks") {
    return toCsv([
      header,
      ...(await risks.listRisks(project.id)).map((r) => [r.title, RISK_KIND_LABELS[r.kind], LEVEL_LABELS[r.likelihood], LEVEL_LABELS[r.impact], RISK_STATUS_LABELS[r.status], r.owner, r.dueDate ?? "", wsName(r.workstreamId), r.description, r.mitigation]),
    ]);
  }
  return toCsv([header, ...(await team.listMembers(project.id)).map((m) => [m.name, m.role, m.email, wsName(m.workstreamId)])]);
}
