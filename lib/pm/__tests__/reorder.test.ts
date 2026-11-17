import { describe, expect, it } from "vitest";
import { changedPositions, columnOf, moveItem, type Orderable } from "../reorder";
import type { TaskStatus } from "../types";

function board(columns: Partial<Record<TaskStatus, string[]>>): Orderable[] {
  return Object.entries(columns).flatMap(([status, ids]) =>
    ids!.map((id, order) => ({ id, status: status as TaskStatus, order })),
  );
}

function ids(items: Orderable[], status: TaskStatus): string[] {
  return columnOf(items, status).map((i) => i.id);
}

describe("columnOf", () => {
  it("returns one column sorted by order regardless of input order", () => {
    const items: Orderable[] = [
      { id: "b", status: "todo", order: 1 },
      { id: "x", status: "done", order: 0 },
      { id: "a", status: "todo", order: 0 },
    ];
    expect(ids(items, "todo")).toEqual(["a", "b"]);
    expect(ids(items, "backlog")).toEqual([]);
  });
});

describe("moveItem", () => {
  it("moves down within a column", () => {
    const next = moveItem(board({ todo: ["a", "b", "c", "d"] }), "a", "todo", 2);
    expect(ids(next, "todo")).toEqual(["b", "c", "a", "d"]);
  });

  it("moves up within a column", () => {
    const next = moveItem(board({ todo: ["a", "b", "c", "d"] }), "d", "todo", 0);
    expect(ids(next, "todo")).toEqual(["d", "a", "b", "c"]);
  });

  it("moves to another column at a given index and closes the gap behind it", () => {
    const next = moveItem(board({ todo: ["a", "b", "c"], done: ["x", "y"] }), "b", "done", 1);
    expect(ids(next, "todo")).toEqual(["a", "c"]);
    expect(ids(next, "done")).toEqual(["x", "b", "y"]);
    expect(columnOf(next, "todo").map((i) => i.order)).toEqual([0, 1]);
    expect(columnOf(next, "done").map((i) => i.order)).toEqual([0, 1, 2]);
  });

  it("moves into an empty column", () => {
    const next = moveItem(board({ todo: ["a", "b"] }), "a", "in_progress", 0);
    expect(ids(next, "in_progress")).toEqual(["a"]);
    expect(ids(next, "todo")).toEqual(["b"]);
  });

  it("clamps out-of-range indexes, so a huge index means end of column", () => {
    const start = board({ todo: ["a", "b"], done: ["x"] });
    expect(ids(moveItem(start, "a", "done", Number.MAX_SAFE_INTEGER), "done")).toEqual(["x", "a"]);
    expect(ids(moveItem(start, "a", "done", Infinity), "done")).toEqual(["x", "a"]);
    expect(ids(moveItem(start, "b", "todo", -5), "todo")).toEqual(["b", "a"]);
  });

  it("is a no-op when the item stays where it is", () => {
    const start = board({ todo: ["a", "b", "c"] });
    const next = moveItem(start, "b", "todo", 1);
    expect(changedPositions(start, next)).toEqual([]);
    expect(next[1]).toBe(start[1]);
  });

  it("returns the items unchanged for an unknown id", () => {
    const start = board({ todo: ["a"] });
    expect(moveItem(start, "nope", "done", 0)).toEqual(start);
  });

  it("does not mutate its input and leaves untouched columns alone", () => {
    const start = board({ backlog: ["k"], todo: ["a", "b"], done: ["x"] });
    const snapshot = JSON.parse(JSON.stringify(start));
    const next = moveItem(start, "a", "done", 0);
    expect(start).toEqual(snapshot);
    expect(next.find((i) => i.id === "k")).toBe(start.find((i) => i.id === "k"));
  });

  it("normalizes gaps and duplicate orders in the columns it touches", () => {
    const start: Orderable[] = [
      { id: "a", status: "todo", order: 3 },
      { id: "b", status: "todo", order: 7 },
      { id: "c", status: "todo", order: 7 },
      { id: "x", status: "done", order: 10 },
    ];
    const next = moveItem(start, "a", "done", 1);
    expect(columnOf(next, "todo").map((i) => [i.id, i.order])).toEqual([["b", 0], ["c", 1]]);
    expect(columnOf(next, "done").map((i) => [i.id, i.order])).toEqual([["x", 0], ["a", 1]]);
  });
});

describe("changedPositions", () => {
  it("lists only the items whose status or order changed", () => {
    const start = board({ todo: ["a", "b", "c"], done: ["x"] });
    const next = moveItem(start, "a", "done", 0);
    expect(changedPositions(start, next).sort((p, q) => p.id.localeCompare(q.id))).toEqual([
      { id: "a", status: "done", order: 0 },
      { id: "b", status: "todo", order: 0 },
      { id: "c", status: "todo", order: 1 },
      { id: "x", status: "done", order: 1 },
    ]);
  });
});
