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
};

export type ProjectWithProgress = Project & { totalTasks: number; doneTasks: number };

export type Milestone = {
  id: string;
  projectId: string;
  name: string;
  targetDate: DateString;
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
