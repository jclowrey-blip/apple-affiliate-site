// Storage-agnostic domain types for the /pm tool. Nothing here imports Prisma,
// so client components can use these freely and the storage layer can be swapped.

export const TASK_STATUSES = ["backlog", "todo", "in_progress", "done"] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];

export const PRIORITIES = ["low", "medium", "high"] as const;
export type Priority = (typeof PRIORITIES)[number];

export const PROJECT_STATUSES = ["active", "on_hold", "done"] as const;
export type ProjectStatus = (typeof PROJECT_STATUSES)[number];

export const STATUS_LABELS: Record<TaskStatus, string> = {
  backlog: "Backlog",
  todo: "To do",
  in_progress: "In progress",
  done: "Done",
};

export const PRIORITY_LABELS: Record<Priority, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
};

export const PROJECT_STATUS_LABELS: Record<ProjectStatus, string> = {
  active: "Active",
  on_hold: "On hold",
  done: "Done",
};

export const PROJECT_COLORS = [
  "#2F6F4E",
  "#2D5F8A",
  "#B3541E",
  "#7A4E9C",
  "#A63D57",
  "#8A7A1F",
  "#3E7C7C",
  "#5B5E63",
] as const;

export type Project = {
  id: string;
  slug: string;
  name: string;
  description: string;
  color: string;
  status: ProjectStatus;
  createdAt: string; // ISO timestamp
};

export type ProjectSummary = Project & {
  totalTasks: number;
  doneTasks: number;
};

export type Milestone = {
  id: string;
  projectId: string;
  name: string;
  targetDate: string; // YYYY-MM-DD
};

export type Subtask = {
  id: string;
  taskId: string;
  title: string;
  done: boolean;
  position: number;
};

export type Task = {
  id: string;
  projectId: string;
  milestoneId: string | null;
  title: string;
  description: string; // markdown
  status: TaskStatus;
  priority: Priority;
  dueDate: string | null; // YYYY-MM-DD
  position: number;
  labels: string[];
  subtasks: Subtask[];
  createdAt: string;
  updatedAt: string;
};

export type ProjectRef = Pick<Project, "id" | "slug" | "name" | "color">;

export type TaskWithProject = Task & { project: ProjectRef };

export type SearchResult = {
  id: string;
  title: string;
  status: TaskStatus;
  snippet: string;
  project: ProjectRef;
};

/** Uniform result shape returned by every server action. */
export type ActionResult<T = undefined> =
  | { ok: true; data: T }
  | { ok: false; error: string };
