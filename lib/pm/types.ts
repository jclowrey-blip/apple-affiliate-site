// Domain types for the /pm tool. Everything here is plain, serializable data
// (dates are ISO strings) so it can cross the server/client boundary and so
// the storage layer behind lib/pm can be swapped without touching the UI.

export const TASK_STATUSES = ["backlog", "todo", "in_progress", "done"] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];
export const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  backlog: "Backlog",
  todo: "To do",
  in_progress: "In progress",
  done: "Done",
};

export const PRIORITIES = ["low", "medium", "high"] as const;
export type Priority = (typeof PRIORITIES)[number];
export const PRIORITY_LABELS: Record<Priority, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
};

export const PROJECT_STATUSES = ["active", "on_hold", "done"] as const;
export type ProjectStatus = (typeof PROJECT_STATUSES)[number];
export const PROJECT_STATUS_LABELS: Record<ProjectStatus, string> = {
  active: "Active",
  on_hold: "On hold",
  done: "Done",
};

export const PROJECT_COLORS = ["#2F6F4E", "#B3541E", "#2B5F8A", "#7A4E9C", "#A8324A", "#5B5E63"] as const;

/** A calendar date with no time component, formatted YYYY-MM-DD. */
export type DateString = string;

export type Project = {
  id: string;
  slug: string;
  name: string;
  description: string;
  color: string;
  status: ProjectStatus;
  createdAt: string;
  /** Approved total budget in whole dollars; 0 when not set. */
  budget: number;
};

export type ProjectWithProgress = Project & { totalTasks: number; doneTasks: number };

export type Milestone = {
  id: string;
  projectId: string;
  workstreamId: string | null;
  name: string;
  /** Current forecast date. */
  targetDate: DateString;
  /** Originally planned date. Slippage is targetDate minus baselineDate. */
  baselineDate: DateString;
  completedDate: DateString | null;
  /** Milestones that must finish before this one. */
  dependsOnIds: string[];
};

export type Workstream = {
  id: string;
  projectId: string;
  name: string;
  description: string;
  owner: string;
  order: number;
  /** 0-100: how much of the workstream's work is done. Drives earned value. */
  percentComplete: number;
  /** The window the workstream's budget is planned across (for planned value). */
  plannedStart: DateString | null;
  plannedFinish: DateString | null;
};

/** Amounts are whole dollars. */
export type BudgetLine = {
  id: string;
  workstreamId: string;
  name: string;
  budget: number;
  committed: number;
  spent: number;
  /** Expected final cost. */
  forecast: number;
  order: number;
};

export const RISK_KINDS = ["risk", "issue"] as const;
export type RiskKind = (typeof RISK_KINDS)[number];
export const RISK_KIND_LABELS: Record<RiskKind, string> = { risk: "Risk", issue: "Issue" };

export const RISK_STATUSES = ["open", "mitigating", "closed"] as const;
export type RiskStatus = (typeof RISK_STATUSES)[number];
export const RISK_STATUS_LABELS: Record<RiskStatus, string> = {
  open: "Open",
  mitigating: "Mitigating",
  closed: "Closed",
};

/** Likelihood and impact are both rated 1 (low) to 3 (high). */
export const LEVELS = [1, 2, 3] as const;
export type Level = (typeof LEVELS)[number];
export const LEVEL_LABELS: Record<Level, string> = { 1: "Low", 2: "Medium", 3: "High" };

export type Risk = {
  id: string;
  projectId: string;
  workstreamId: string | null;
  kind: RiskKind;
  title: string;
  description: string;
  mitigation: string;
  owner: string;
  likelihood: Level;
  impact: Level;
  status: RiskStatus;
  dueDate: DateString | null;
  createdAt: string;
  updatedAt: string;
};

export type RiskWithProject = Risk & { project: ProjectRef };

export type StatusReport = {
  id: string;
  projectId: string;
  title: string;
  periodStart: DateString;
  periodEnd: DateString;
  /** Markdown. */
  body: string;
  source: "generated" | "assistant";
  /** "status" is a period report; "daily" is the end-of-day summary. */
  kind: "status" | "daily";
  createdAt: string;
};

export type TeamMember = {
  id: string;
  projectId: string;
  workstreamId: string | null;
  name: string;
  role: string;
  email: string;
};

/** A drafted message. The tool never sends; "sent" records that the user did. */
export type Communication = {
  id: string;
  projectId: string;
  memberId: string | null;
  kind: "update_request" | "summary";
  recipient: string;
  email: string;
  subject: string;
  body: string;
  forDate: DateString;
  status: "draft" | "sent";
  /** generated = drafted from the data; assistant = written by the assistant; edited = changed by the user. */
  source: "generated" | "assistant" | "edited";
  createdAt: string;
};

export type Activity = {
  id: string;
  projectId: string;
  kind: "change" | "note";
  summary: string;
  at: string;
};

export type Subtask = {
  id: string;
  taskId: string;
  title: string;
  done: boolean;
  order: number;
};

export type Task = {
  id: string;
  projectId: string;
  milestoneId: string | null;
  title: string;
  description: string;
  status: TaskStatus;
  priority: Priority;
  dueDate: DateString | null;
  order: number;
  labels: string[];
  subtasks: Subtask[];
  createdAt: string;
  updatedAt: string;
};

export type ProjectRef = { slug: string; name: string; color: string };
export type TaskWithProject = Task & { project: ProjectRef };

export type SearchResult = {
  id: string;
  title: string;
  status: TaskStatus;
  snippet: string;
  project: ProjectRef;
};

export class PmNotFoundError extends Error {
  constructor(what: string) {
    super(`${what} not found`);
    this.name = "PmNotFoundError";
  }
}

/** What every server action returns: data on success, a user-facing message on failure. */
export type ActionResult<T = null> = { ok: true; data: T } | { ok: false; error: string };

/** A request that is well-formed but not allowed (for example a dependency loop). */
export class PmValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PmValidationError";
  }
}
