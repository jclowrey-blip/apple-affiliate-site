// Pure task-ordering logic shared by the server (persisting a move) and the
// client (optimistic board updates). No storage or React imports.
import type { TaskStatus } from "./types";

export type Orderable = { id: string; status: TaskStatus; position: number };

/** Tasks of one status column in display order (position, then id as a stable tie-break). */
export function sortColumn<T extends Orderable>(tasks: readonly T[], status: TaskStatus): T[] {
  return tasks
    .filter((t) => t.status === status)
    .sort((a, b) => a.position - b.position || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}

/**
 * Move a task to `toIndex` of the `toStatus` column and return the full task
 * list with the source and destination columns renumbered 0..n-1.
 *
 * `toIndex` is the task's index in the destination column after the move
 * (i.e. counted with the task itself removed first). It is clamped to the
 * valid range. Returns the input untouched if the task does not exist.
 */
export function applyMove<T extends Orderable>(
  tasks: readonly T[],
  taskId: string,
  toStatus: TaskStatus,
  toIndex: number,
): T[] {
  const moving = tasks.find((t) => t.id === taskId);
  if (!moving) return [...tasks];

  const fromStatus = moving.status;
  const destination = sortColumn(tasks, toStatus).filter((t) => t.id !== taskId);
  const index = Math.max(0, Math.min(Math.trunc(toIndex) || 0, destination.length));
  destination.splice(index, 0, moving);

  const next = new Map<string, { status: TaskStatus; position: number }>();
  destination.forEach((t, i) => next.set(t.id, { status: toStatus, position: i }));
  if (fromStatus !== toStatus) {
    sortColumn(tasks, fromStatus)
      .filter((t) => t.id !== taskId)
      .forEach((t, i) => next.set(t.id, { status: fromStatus, position: i }));
  }

  return tasks.map((t) => {
    const n = next.get(t.id);
    return n && (n.status !== t.status || n.position !== t.position) ? { ...t, ...n } : t;
  });
}

/** The tasks whose status or position differ between two versions of a list. */
export function changedPlacements(before: readonly Orderable[], after: readonly Orderable[]): Orderable[] {
  const prev = new Map(before.map((t) => [t.id, t]));
  return after
    .filter((t) => {
      const p = prev.get(t.id);
      return !p || p.status !== t.status || p.position !== t.position;
    })
    .map(({ id, status, position }) => ({ id, status, position }));
}

/** Where a task currently sits: its column and index within it. */
export function placementOf(tasks: readonly Orderable[], taskId: string): { status: TaskStatus; index: number } | null {
  const task = tasks.find((t) => t.id === taskId);
  if (!task) return null;
  return { status: task.status, index: sortColumn(tasks, task.status).findIndex((t) => t.id === taskId) };
}
