// Moving data between this tracker and other tools (Azure DevOps, MS Project,
// Primavera, Excel…) as CSV. This file is the pure half: which fields each
// kind of record has, how to recognise another tool's column names, and how
// to read its values. Applying an import to the database is in import.ts.
import { parseCsv } from "./csv";
import { parseMoney } from "./money";
import type { DateString, Level, RiskKind, RiskStatus } from "./types";

export const ENTITY_KEYS = ["milestones", "budget", "risks", "team"] as const;
export type EntityKey = (typeof ENTITY_KEYS)[number];

export type FieldDef = {
  key: string;
  /** Column header used on export. */
  label: string;
  required?: boolean;
  /** Other tools' names for this column, matched ignoring case and punctuation. */
  aliases: string[];
  hint?: string;
};

export const ENTITIES: Record<EntityKey, { label: string; matchedBy: string; fields: FieldDef[] }> = {
  milestones: {
    label: "Milestones",
    matchedBy: "name",
    fields: [
      { key: "name", label: "Name", required: true, aliases: ["milestone", "title", "task name", "activity name", "activity", "summary"] },
      { key: "targetDate", label: "Target date", required: true, aliases: ["target", "finish", "finish date", "end date", "due date", "due", "forecast finish", "forecast date", "planned finish", "early finish"] },
      { key: "baselineDate", label: "Baseline date", aliases: ["baseline", "baseline finish", "baseline end", "original finish", "bl project finish", "bl finish"] },
      { key: "completedDate", label: "Completed date", aliases: ["completed", "actual finish", "actual end", "closed date", "done date", "resolved date"] },
      { key: "status", label: "Status", aliases: ["state", "percent complete", "% complete"], hint: "Done, Closed, Completed or 100% marks it complete" },
      { key: "workstream", label: "Workstream", aliases: ["area path", "area", "wbs", "wbs name", "phase", "category", "epic", "team", "discipline"] },
      { key: "dependsOn", label: "Depends on", aliases: ["predecessors", "predecessor", "depends", "dependencies", "blocked by", "parent"], hint: "Milestone names separated by ; " },
    ],
  },
  budget: {
    label: "Budget lines",
    matchedBy: "workstream and name",
    fields: [
      { key: "workstream", label: "Workstream", required: true, aliases: ["area path", "area", "wbs", "wbs name", "phase", "category", "control account", "discipline"] },
      { key: "name", label: "Name", required: true, aliases: ["line", "budget line", "description", "cost code", "cost item", "title", "item", "account"] },
      { key: "budget", label: "Budget", aliases: ["budget at completion", "bac", "baseline cost", "original budget", "approved budget", "budgeted cost"] },
      { key: "committed", label: "Committed", aliases: ["commitments", "committed cost", "contracted", "po value"] },
      { key: "spent", label: "Spent", aliases: ["actual", "actuals", "actual cost", "spent to date", "incurred", "ac", "acwp"] },
      { key: "forecast", label: "Forecast", aliases: ["forecast at completion", "eac", "estimate at completion", "forecast cost", "projected cost"] },
    ],
  },
  risks: {
    label: "Risks and issues",
    matchedBy: "title",
    fields: [
      { key: "title", label: "Title", required: true, aliases: ["name", "risk", "issue", "summary", "risk title", "description of risk"] },
      { key: "kind", label: "Type", aliases: ["kind", "work item type", "category", "risk or issue"], hint: "Risk or Issue" },
      { key: "likelihood", label: "Likelihood", aliases: ["probability", "chance"], hint: "Low / Medium / High, or 1-3" },
      { key: "impact", label: "Impact", aliases: ["severity", "consequence", "priority"], hint: "Low / Medium / High, or 1-3" },
      { key: "status", label: "Status", aliases: ["state"], hint: "Open, Mitigating or Closed" },
      { key: "owner", label: "Owner", aliases: ["assigned to", "assignee", "risk owner", "responsible"] },
      { key: "dueDate", label: "Due date", aliases: ["due", "target date", "action date", "review date"] },
      { key: "workstream", label: "Workstream", aliases: ["area path", "area", "wbs", "phase", "discipline"] },
      { key: "description", label: "Description", aliases: ["details", "cause", "risk description"] },
      { key: "mitigation", label: "Mitigation", aliases: ["response", "mitigation plan", "action", "next action", "response plan", "resolution"] },
    ],
  },
  team: {
    label: "Team members",
    matchedBy: "email, or name when there is no email",
    fields: [
      { key: "name", label: "Name", required: true, aliases: ["full name", "display name", "person", "member", "resource", "resource name"] },
      { key: "role", label: "Role", aliases: ["title", "job title", "position", "function"] },
      { key: "email", label: "Email", aliases: ["email address", "e-mail", "mail", "unique name"] },
      { key: "workstream", label: "Workstream", aliases: ["area path", "area", "team", "wbs", "discipline"] },
    ],
  },
};

const normalize = (text: string) => text.toLowerCase().replace(/[^a-z0-9%]+/g, "");

/** A mapping from field key to column index (null = not provided). */
export type ColumnMapping = Record<string, number | null>;

/** Guesses which column holds each field from the header names. Each column is used once. */
export function autoMap(entity: EntityKey, headers: readonly string[]): ColumnMapping {
  const cols = headers.map(normalize);
  const used = new Set<number>();
  const mapping: ColumnMapping = {};
  const fields = ENTITIES[entity].fields;
  // Exact matches on the field's own name first, then aliases, so "Name" isn't lost to an alias of another field.
  for (const pass of ["own", "alias"] as const) {
    for (const field of fields) {
      if (mapping[field.key] !== undefined && mapping[field.key] !== null) continue;
      const names = pass === "own" ? [field.label, field.key] : field.aliases;
      const index = cols.findIndex((c, i) => !used.has(i) && names.some((n) => normalize(n) === c));
      mapping[field.key] = index >= 0 ? index : (mapping[field.key] ?? null);
      if (index >= 0) used.add(index);
    }
  }
  return mapping;
}

const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
const iso = (y: number, m: number, d: number): DateString | null => {
  if (m < 1 || m > 12 || d < 1 || d > 31 || y < 1900 || y > 2200) return null;
  const date = new Date(Date.UTC(y, m - 1, d));
  if (date.getUTCMonth() !== m - 1) return null; // e.g. Feb 30
  return date.toISOString().slice(0, 10);
};

/**
 * Reads a date in the forms other tools export: 2027-03-01, 2027-03-01T08:00:00Z,
 * 3/1/2027 (month first, US style), 1-Mar-2027, Mar 1 2027, March 1, 2027.
 */
export function parseDate(input: string): DateString | null {
  const text = input.trim();
  if (!text) return null;
  let m = /^(\d{4})-(\d{1,2})-(\d{1,2})(?:[T ].*)?$/.exec(text);
  if (m) return iso(+m[1], +m[2], +m[3]);
  m = /^(\d{1,2})[/.](\d{1,2})[/.](\d{2,4})(?:\s.*)?$/.exec(text);
  if (m) return iso(m[3].length === 2 ? 2000 + +m[3] : +m[3], +m[1], +m[2]);
  m = /^(\d{1,2})[-\s]([A-Za-z]{3,9})[-\s,]+(\d{2,4})$/.exec(text);
  if (m) {
    const month = MONTHS.indexOf(m[2].slice(0, 3).toLowerCase()) + 1;
    return month ? iso(m[3].length === 2 ? 2000 + +m[3] : +m[3], month, +m[1]) : null;
  }
  m = /^([A-Za-z]{3,9})\.?\s+(\d{1,2}),?\s+(\d{4})$/.exec(text);
  if (m) {
    const month = MONTHS.indexOf(m[1].slice(0, 3).toLowerCase()) + 1;
    return month ? iso(+m[3], month, +m[2]) : null;
  }
  return null;
}

export function parseLevel(input: string): Level | null {
  const t = normalize(input);
  if (!t) return null;
  if (["1", "low", "l", "minor", "unlikely", "rare"].includes(t)) return 1;
  if (["2", "medium", "med", "m", "moderate", "possible"].includes(t)) return 2;
  if (["3", "high", "h", "major", "critical", "severe", "likely", "veryhigh", "4", "5"].includes(t)) return 3;
  return null;
}

export function parseRiskStatus(input: string): RiskStatus | null {
  const t = normalize(input);
  if (!t) return null;
  if (["open", "new", "active", "proposed", "identified", "todo"].includes(t)) return "open";
  if (["mitigating", "mitigation", "inprogress", "monitoring", "doing", "committed", "underreview"].includes(t)) return "mitigating";
  if (["closed", "done", "resolved", "removed", "completed", "retired", "accepted"].includes(t)) return "closed";
  return null;
}

export function parseRiskKind(input: string): RiskKind | null {
  const t = normalize(input);
  if (!t) return null;
  if (t.includes("issue") || t === "bug" || t === "impediment" || t === "problem") return "issue";
  if (t.includes("risk")) return "risk";
  return null;
}

/** True when a status cell says the work is finished. */
export function isDoneStatus(input: string): boolean {
  return ["done", "closed", "complete", "completed", "resolved", "finished", "100%", "100"].includes(normalize(input));
}

// ---- reading a file into validated records

export type ImportRecord = { line: number; values: Record<string, string> };
export type ImportIssue = { line: number; message: string };

export type MilestoneImport = { name: string; targetDate: DateString; baselineDate?: DateString; completedDate?: DateString; done: boolean; workstream?: string; dependsOn: string[] };
export type BudgetImport = { workstream: string; name: string; budget?: number; committed?: number; spent?: number; forecast?: number };
export type RiskImport = { title: string; kind?: RiskKind; likelihood?: Level; impact?: Level; status?: RiskStatus; owner?: string; dueDate?: DateString | null; workstream?: string; description?: string; mitigation?: string };
export type TeamImport = { name: string; role?: string; email?: string; workstream?: string };
export type ImportItems = { milestones: MilestoneImport[]; budget: BudgetImport[]; risks: RiskImport[]; team: TeamImport[] };

export type ReadResult<K extends EntityKey> = { headers: string[]; mapping: ColumnMapping; items: (ImportItems[K][number] & { line: number })[]; issues: ImportIssue[]; rowCount: number };

/**
 * Parses CSV text for one kind of record. Rows that can't be read are
 * reported by line number and left out; nothing is guessed.
 */
export function readImport<K extends EntityKey>(entity: K, csv: string, mappingOverride?: ColumnMapping): ReadResult<K> {
  const rows = parseCsv(csv);
  const headers = (rows[0] ?? []).map((h) => h.trim());
  const mapping = { ...autoMap(entity, headers), ...(mappingOverride ?? {}) };
  const fields = ENTITIES[entity].fields;
  const issues: ImportIssue[] = [];
  const items: (Record<string, unknown> & { line: number })[] = [];

  const missing = fields.filter((f) => f.required && (mapping[f.key] === null || mapping[f.key] === undefined));
  if (rows.length === 0) issues.push({ line: 1, message: "The file is empty." });
  else if (missing.length) issues.push({ line: 1, message: `No column found for: ${missing.map((f) => f.label).join(", ")}. Choose the matching columns above.` });

  if (!issues.length) {
    rows.slice(1).forEach((cells, i) => {
      const line = i + 2;
      const get = (key: string) => {
        const index = mapping[key];
        return index === null || index === undefined ? "" : (cells[index] ?? "").trim();
      };
      const problems: string[] = [];
      const need = (key: string, label: string) => {
        const v = get(key);
        if (!v) problems.push(`${label} is blank`);
        return v;
      };
      const dateOf = (key: string, label: string, required = false) => {
        const raw = get(key);
        if (!raw) {
          if (required) problems.push(`${label} is blank`);
          return undefined;
        }
        const parsed = parseDate(raw);
        if (!parsed) problems.push(`${label} "${raw}" isn't a date I can read`);
        return parsed ?? undefined;
      };
      const moneyOf = (key: string, label: string) => {
        const raw = get(key);
        if (!raw) return undefined;
        const parsed = parseMoney(raw.replace(/^usd\s*/i, "").replace(/\.\d{1,2}$/, ""));
        if (parsed === null) problems.push(`${label} "${raw}" isn't an amount I can read`);
        return parsed ?? undefined;
      };
      const pick = <T>(key: string, label: string, parse: (s: string) => T | null, expected: string) => {
        const raw = get(key);
        if (!raw) return undefined;
        const parsed = parse(raw);
        if (parsed === null) problems.push(`${label} "${raw}" isn't recognised (expected ${expected})`);
        return parsed ?? undefined;
      };
      const opt = (key: string) => get(key) || undefined;

      let item: Record<string, unknown>;
      if (entity === "milestones") {
        const status = get("status");
        item = {
          name: need("name", "Name"),
          targetDate: dateOf("targetDate", "Target date", true),
          baselineDate: dateOf("baselineDate", "Baseline date"),
          completedDate: dateOf("completedDate", "Completed date"),
          done: isDoneStatus(status),
          workstream: opt("workstream"),
          dependsOn: get("dependsOn").split(/[;|\n]/).map((s) => s.trim()).filter(Boolean),
        };
      } else if (entity === "budget") {
        item = {
          workstream: need("workstream", "Workstream"),
          name: need("name", "Name"),
          budget: moneyOf("budget", "Budget"),
          committed: moneyOf("committed", "Committed"),
          spent: moneyOf("spent", "Spent"),
          forecast: moneyOf("forecast", "Forecast"),
        };
      } else if (entity === "risks") {
        item = {
          title: need("title", "Title"),
          kind: pick("kind", "Type", parseRiskKind, "Risk or Issue"),
          likelihood: pick("likelihood", "Likelihood", parseLevel, "Low, Medium, High or 1-3"),
          impact: pick("impact", "Impact", parseLevel, "Low, Medium, High or 1-3"),
          status: pick("status", "Status", parseRiskStatus, "Open, Mitigating or Closed"),
          owner: opt("owner"),
          dueDate: dateOf("dueDate", "Due date"),
          workstream: opt("workstream"),
          description: opt("description"),
          mitigation: opt("mitigation"),
        };
      } else {
        const email = get("email");
        if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) problems.push(`Email "${email}" doesn't look like an address`);
        item = { name: need("name", "Name"), role: opt("role"), email: email || undefined, workstream: opt("workstream") };
      }

      if (problems.length) issues.push({ line, message: problems.join("; ") });
      else items.push({ ...item, line });
    });
  }

  return { headers, mapping, items: items as unknown as ReadResult<K>["items"], issues, rowCount: Math.max(0, rows.length - 1) };
}
