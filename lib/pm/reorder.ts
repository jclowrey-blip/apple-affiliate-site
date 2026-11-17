// Pure task-ordering logic, shared by the server (to persist a move) and the
// client (to apply the same move optimistically). No storage imports.
import type { TaskStatus } from "./types";

export type Orderable = { id: string; status: TaskStatus; order: number };
export type Position = { id: string; status: TaskStatus; order: number };

/** Items in one status column, sorted by their order. */
export function columnOf<T extends Orderable>(items: readonly T[], status: TaskStatus): T[] {
  return items.filter((i) => i.status === status).sort((a, b) => a.order - b.order);
}

/**
 * Move an item to `toIndex` within the `toStatus` column and renumber the
 * affected columns 0..n-1. `toIndex` is the position the item should end up
 * at, counted with the item itself removed; out-of-range values are clamped,
 * so `Infinity` means "end of column".
 *
 * Returns a new array in the same element order as the input. Items whose
 * position did not change keep their identity.
 */
export function moveItem<T extends Orderable>(
  items: readonly T[],
  id: string,
  toStatus: TaskStatus,
  toIndex: number,
): T[] {
  const item = items.find((i) => i.id === id);
  if (!item) return [...items];

  const source = columnOf(items, item.status).filter((i) => i.id !== id);
  const target = toStatus === item.status ? source : columnOf(items, toStatus);
  const index = Math.max(0, Math.min(Number.isNaN(toIndex) ? target.length : toIndex, target.length));
  target.splice(index, 0, item);

  const next = new Map<string, { status: TaskStatus; order: number }>();
  source.forEach((i, order) => next.set(i.id, { status: item.status, order }));
  target.forEach((i, order) => next.set(i.id, { status: toStatus, order }));

  return items.map((i) => {
    const pos = next.get(i.id);
    if (!pos || (pos.status === i.status && pos.order === i.order)) return i;
    return { ...i, status: pos.status, order: pos.order };
  });
}

/** Positions that differ between two versions of the same item set. */
export function changedPositions(before: readonly Orderable[], after: readonly Orderable[]): Position[] {
  const prev = new Map(before.map((i) => [i.id, i]));
  return after
    .filter((i) => {
      const p = prev.get(i.id);
      return !p || p.status !== i.status || p.order !== i.order;
    })
    .map(({ id, status, order }) => ({ id, status, order }));
}
