import { describe, expect, it } from "vitest";
import { applyMove, changedPlacements, placementOf, sortColumn, type Orderable } from "../ordering";
import type { TaskStatus } from "../types";

const t = (id: string, status: TaskStatus, position: number): Orderable => ({ id, status, position });

const board = (): Orderable[] => [
  t("a", "todo", 0),
  t("b", "todo", 1),
  t("c", "todo", 2),
  t("x", "in_progress", 0),
  t("y", "in_progress", 1),
  t("z", "done", 0),
];

const ids = (tasks: Orderable[], status: TaskStatus) => sortColumn(tasks, status).map((x) => x.id);
const positions = (tasks: Orderable[], status: TaskStatus) => sortColumn(tasks, status).map((x) => x.position);

describe("sortColumn", () => {
  it("orders by position and ignores other statuses", () => {
    expect(ids([t("b", "todo", 1), t("z", "done", 0), t("a", "todo", 0)], "todo")).toEqual(["a", "b"]);
  });

  it("breaks position ties by id so order is stable", () => {
    expect(ids([t("b", "todo", 0), t("a", "todo", 0)], "todo")).toEqual(["a", "b"]);
  });
});

describe("applyMove within a column", () => {
  it("moves a task down", () => {
    const next = applyMove(board(), "a", "todo", 2);
    expect(ids(next, "todo")).toEqual(["b", "c", "a"]);
    expect(positions(next, "todo")).toEqual([0, 1, 2]);
  });

  it("moves a task up", () => {
    expect(ids(applyMove(board(), "c", "todo", 0), "todo")).toEqual(["c", "a", "b"]);
  });

  it("is a no-op when dropped in place", () => {
    const before = board();
    const next = applyMove(before, "b", "todo", 1);
    expect(changedPlacements(before, next)).toEqual([]);
  });

  it("leaves other columns untouched", () => {
    const next = applyMove(board(), "a", "todo", 2);
    expect(ids(next, "in_progress")).toEqual(["x", "y"]);
    expect(ids(next, "done")).toEqual(["z"]);
  });
});

describe("applyMove between columns", () => {
  it("inserts at the requested index and renumbers both columns", () => {
    const next = applyMove(board(), "b", "in_progress", 1);
    expect(ids(next, "todo")).toEqual(["a", "c"]);
    expect(positions(next, "todo")).toEqual([0, 1]);
    expect(ids(next, "in_progress")).toEqual(["x", "b", "y"]);
    expect(positions(next, "in_progress")).toEqual([0, 1, 2]);
  });

  it("moves into an empty column", () => {
    const next = applyMove(board(), "a", "backlog", 0);
    expect(ids(next, "backlog")).toEqual(["a"]);
    expect(ids(next, "todo")).toEqual(["b", "c"]);
  });

  it("can empty the source column", () => {
    const next = applyMove(board(), "z", "todo", 0);
    expect(ids(next, "done")).toEqual([]);
    expect(ids(next, "todo")).toEqual(["z", "a", "b", "c"]);
  });
});

describe("applyMove edge cases", () => {
  it("clamps an index past the end", () => {
    expect(ids(applyMove(board(), "a", "in_progress", 99), "in_progress")).toEqual(["x", "y", "a"]);
  });

  it("clamps a negative or non-finite index to the top", () => {
    expect(ids(applyMove(board(), "c", "todo", -5), "todo")).toEqual(["c", "a", "b"]);
    expect(ids(applyMove(board(), "c", "todo", NaN), "todo")).toEqual(["c", "a", "b"]);
  });

  it("returns the list unchanged for an unknown task", () => {
    expect(applyMove(board(), "nope", "done", 0)).toEqual(board());
  });

  it("does not mutate its input", () => {
    const before = board();
    const snapshot = JSON.parse(JSON.stringify(before));
    applyMove(before, "a", "done", 0);
    expect(before).toEqual(snapshot);
  });

  it("repairs gaps and duplicate positions in the columns it touches", () => {
    const messy = [t("a", "todo", 5), t("b", "todo", 5), t("c", "todo", 40), t("x", "done", 7)];
    const next = applyMove(messy, "c", "todo", 0);
    expect(ids(next, "todo")).toEqual(["c", "a", "b"]);
    expect(positions(next, "todo")).toEqual([0, 1, 2]);
  });

  it("keeps extra fields on the task objects", () => {
    const tasks = [{ ...t("a", "todo", 0), title: "Keep me" }, { ...t("b", "todo", 1), title: "And me" }];
    const moved = applyMove(tasks, "a", "done", 0).find((x) => x.id === "a");
    expect(moved).toEqual({ id: "a", status: "done", position: 0, title: "Keep me" });
  });
});

describe("changedPlacements", () => {
  it("reports only the tasks whose status or position changed", () => {
    const before = board();
    const changed = changedPlacements(before, applyMove(before, "b", "in_progress", 0));
    expect(changed).toEqual(
      expect.arrayContaining([
        { id: "b", status: "in_progress", position: 0 },
        { id: "c", status: "todo", position: 1 },
        { id: "x", status: "in_progress", position: 1 },
        { id: "y", status: "in_progress", position: 2 },
      ]),
    );
    expect(changed).toHaveLength(4);
  });
});

describe("placementOf", () => {
  it("returns the column and index of a task", () => {
    expect(placementOf(board(), "y")).toEqual({ status: "in_progress", index: 1 });
    expect(placementOf(board(), "nope")).toBeNull();
  });
});
