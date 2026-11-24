import { beforeEach, describe, expect, it } from "vitest";
import { db } from "../db";
import { NotFoundError, PmError } from "../errors";
import { createMilestone, deleteMilestone, listMilestones, updateMilestone } from "../milestones";
import { createProject, deleteProject, getProjectBySlug, listProjectSummaries, slugify, updateProject } from "../projects";
import { createMilestoneSchema, createProjectSchema, createTaskSchema, moveTaskSchema, updateTaskSchema } from "../schemas";
import { makeSnippet, searchTasks } from "../search";
import { createSubtask, deleteSubtask, updateSubtask } from "../subtasks";
import {
  createTask,
  deleteTask,
  getTask,
  listLabels,
  listOverdueTasks,
  listTasks,
  listTasksDueBetween,
  moveTask,
  updateTask,
} from "../tasks";
import type { TaskStatus } from "../types";

const newProject = (name = "Side project") => createProject(createProjectSchema.parse({ name }));
const newTask = (projectId: string, title: string, extra: Record<string, unknown> = {}) =>
  createTask(createTaskSchema.parse({ projectId, title, ...extra }));
const column = async (projectId: string, status: TaskStatus) =>
  (await listTasks(projectId)).filter((t) => t.status === status).map((t) => t.title);

beforeEach(async () => {
  await db.project.deleteMany();
});

describe("projects", () => {
  it("creates a project with defaults and a slug", async () => {
    const p = await newProject("Orchard Storefront!");
    expect(p).toMatchObject({ slug: "orchard-storefront", status: "active", description: "" });
    expect(await getProjectBySlug("orchard-storefront")).toMatchObject({ id: p.id });
    expect(await getProjectBySlug("missing")).toBeNull();
  });

  it("makes slugs unique", async () => {
    const [a, b, c] = [await newProject("Blog"), await newProject("Blog"), await newProject("blog")];
    expect([a.slug, b.slug, c.slug]).toEqual(["blog", "blog-2", "blog-3"]);
  });

  it("slugifies names with no usable characters", () => {
    expect(slugify("???")).toBe("project");
  });

  it("keeps the slug when renamed", async () => {
    const p = await newProject("Blog");
    const updated = await updateProject({ id: p.id, name: "Journal", status: "on_hold" });
    expect(updated).toMatchObject({ name: "Journal", slug: "blog", status: "on_hold" });
  });

  it("summarises done and total tasks", async () => {
    const p = await newProject();
    const empty = await newProject("Empty");
    await newTask(p.id, "one", { status: "done" });
    await newTask(p.id, "two", { status: "done" });
    await newTask(p.id, "three");
    const summaries = await listProjectSummaries();
    expect(summaries.find((s) => s.id === p.id)).toMatchObject({ totalTasks: 3, doneTasks: 2 });
    expect(summaries.find((s) => s.id === empty.id)).toMatchObject({ totalTasks: 0, doneTasks: 0 });
  });

  it("deleting a project removes its tasks, subtasks, milestones and labels", async () => {
    const p = await newProject();
    const m = await createMilestone({ projectId: p.id, name: "v1", targetDate: "2026-01-01" });
    const task = await newTask(p.id, "one", { labels: ["x"], milestoneId: m.id });
    await createSubtask({ taskId: task.id, title: "sub" });
    await deleteProject(p.id);
    const counts = await Promise.all([db.task.count(), db.subtask.count(), db.milestone.count(), db.label.count()]);
    expect(counts).toEqual([0, 0, 0, 0]);
  });

  it("throws NotFoundError for unknown ids", async () => {
    await expect(updateProject({ id: "nope", name: "x" })).rejects.toBeInstanceOf(NotFoundError);
    await expect(deleteProject("nope")).rejects.toBeInstanceOf(NotFoundError);
  });
});

describe("tasks", () => {
  it("creates tasks at the bottom of their status column", async () => {
    const p = await newProject();
    const a = await newTask(p.id, "a");
    const b = await newTask(p.id, "b");
    const c = await newTask(p.id, "c", { status: "done" });
    expect([a.position, b.position, c.position]).toEqual([0, 1, 0]);
    expect(a).toMatchObject({ status: "todo", priority: "medium", dueDate: null, labels: [], subtasks: [] });
  });

  it("rejects a task for a missing project", async () => {
    await expect(newTask("nope", "a")).rejects.toBeInstanceOf(NotFoundError);
  });

  it("returns a task with its project, or null", async () => {
    const p = await newProject("Blog");
    const a = await newTask(p.id, "a");
    expect(await getTask(a.id)).toMatchObject({ title: "a", project: { slug: "blog", name: "Blog" } });
    expect(await getTask("nope")).toBeNull();
  });

  it("updates fields and leaves the rest alone", async () => {
    const p = await newProject();
    const a = await newTask(p.id, "a", { description: "keep", priority: "high" });
    const updated = await updateTask({ id: a.id, title: "renamed", dueDate: "2026-03-01" });
    expect(updated).toMatchObject({ title: "renamed", dueDate: "2026-03-01", description: "keep", priority: "high" });
    expect((await updateTask({ id: a.id, dueDate: null })).dueDate).toBeNull();
  });

  it("moves a task to the bottom of the new column when its status changes", async () => {
    const p = await newProject();
    const a = await newTask(p.id, "a");
    await newTask(p.id, "d1", { status: "done" });
    await newTask(p.id, "d2", { status: "done" });
    await updateTask({ id: a.id, status: "done" });
    expect(await column(p.id, "done")).toEqual(["d1", "d2", "a"]);
  });

  it("replaces labels, de-duplicates them and prunes unused ones", async () => {
    const p = await newProject();
    const a = await newTask(p.id, "a", { labels: ["bug", "ui", "bug"] });
    await newTask(p.id, "b", { labels: ["ui"] });
    expect(a.labels).toEqual(["bug", "ui"]);
    expect(await listLabels(p.id)).toEqual(["bug", "ui"]);

    const updated = await updateTask({ id: a.id, labels: ["docs"] });
    expect(updated.labels).toEqual(["docs"]);
    expect(await listLabels(p.id)).toEqual(["docs", "ui"]);
  });

  it("keeps labels separate per project", async () => {
    const [p1, p2] = [await newProject("One"), await newProject("Two")];
    await newTask(p1.id, "a", { labels: ["shared"] });
    await newTask(p2.id, "b", { labels: ["shared", "only-two"] });
    expect(await listLabels(p1.id)).toEqual(["shared"]);
    expect(await listLabels(p2.id)).toEqual(["only-two", "shared"]);
  });

  it("deletes a task with its subtasks and prunes its labels", async () => {
    const p = await newProject();
    const a = await newTask(p.id, "a", { labels: ["solo"] });
    await createSubtask({ taskId: a.id, title: "sub" });
    await deleteTask(a.id);
    expect(await listTasks(p.id)).toEqual([]);
    expect(await db.subtask.count()).toBe(0);
    expect(await listLabels(p.id)).toEqual([]);
    await expect(deleteTask(a.id)).rejects.toBeInstanceOf(NotFoundError);
  });
});

describe("moveTask", () => {
  async function seedBoard() {
    const p = await newProject();
    const tasks: Record<string, string> = {};
    for (const title of ["a", "b", "c"]) tasks[title] = (await newTask(p.id, title)).id;
    for (const title of ["x", "y"]) tasks[title] = (await newTask(p.id, title, { status: "in_progress" })).id;
    return { p, tasks };
  }

  it("reorders within a column and persists", async () => {
    const { p, tasks } = await seedBoard();
    await moveTask({ id: tasks.c, status: "todo", index: 0 });
    expect(await column(p.id, "todo")).toEqual(["c", "a", "b"]);
    await moveTask({ id: tasks.c, status: "todo", index: 2 });
    expect(await column(p.id, "todo")).toEqual(["a", "b", "c"]);
  });

  it("moves between columns at an index and renumbers both", async () => {
    const { p, tasks } = await seedBoard();
    const changed = await moveTask({ id: tasks.a, status: "in_progress", index: 1 });
    expect(await column(p.id, "todo")).toEqual(["b", "c"]);
    expect(await column(p.id, "in_progress")).toEqual(["x", "a", "y"]);
    const all = await listTasks(p.id);
    expect(all.filter((t) => t.status === "todo").map((t) => t.position)).toEqual([0, 1]);
    expect(all.filter((t) => t.status === "in_progress").map((t) => t.position)).toEqual([0, 1, 2]);
    expect(changed.map((c) => c.id).sort()).toEqual([tasks.a, tasks.b, tasks.c, tasks.y].sort());
  });

  it("writes nothing when the task is dropped where it was", async () => {
    const { tasks } = await seedBoard();
    expect(await moveTask({ id: tasks.b, status: "todo", index: 1 })).toEqual([]);
  });

  it("does not touch other projects", async () => {
    const { tasks } = await seedBoard();
    const other = await newProject("Other");
    await newTask(other.id, "o1");
    await newTask(other.id, "o2");
    await moveTask({ id: tasks.a, status: "todo", index: 2 });
    expect(await column(other.id, "todo")).toEqual(["o1", "o2"]);
  });

  it("throws for an unknown task", async () => {
    await expect(moveTask({ id: "nope", status: "todo", index: 0 })).rejects.toBeInstanceOf(NotFoundError);
  });
});

describe("due date queries", () => {
  it("splits overdue from upcoming and ignores done and undated tasks", async () => {
    const p = await newProject();
    await newTask(p.id, "late", { dueDate: "2026-05-01" });
    await newTask(p.id, "late but done", { dueDate: "2026-05-02", status: "done" });
    await newTask(p.id, "today", { dueDate: "2026-05-10" });
    await newTask(p.id, "sunday", { dueDate: "2026-05-17" });
    await newTask(p.id, "next week", { dueDate: "2026-05-18" });
    await newTask(p.id, "undated");

    const overdue = await listOverdueTasks("2026-05-10");
    expect(overdue.map((t) => t.title)).toEqual(["late"]);
    expect(overdue[0].project.id).toBe(p.id);

    const week = await listTasksDueBetween("2026-05-10", "2026-05-17");
    expect(week.map((t) => t.title)).toEqual(["today", "sunday"]);
  });
});

describe("milestones", () => {
  it("lists milestones by target date and updates them", async () => {
    const p = await newProject();
    const later = await createMilestone({ projectId: p.id, name: "later", targetDate: "2026-09-01" });
    await createMilestone({ projectId: p.id, name: "sooner", targetDate: "2026-06-01" });
    expect((await listMilestones(p.id)).map((m) => m.name)).toEqual(["sooner", "later"]);
    await updateMilestone({ id: later.id, targetDate: "2026-05-01" });
    expect((await listMilestones(p.id)).map((m) => m.name)).toEqual(["later", "sooner"]);
  });

  it("assigns tasks only to milestones of the same project", async () => {
    const [p1, p2] = [await newProject("One"), await newProject("Two")];
    const m1 = await createMilestone({ projectId: p1.id, name: "m1", targetDate: "2026-06-01" });
    const task = await newTask(p1.id, "a", { milestoneId: m1.id });
    expect(task.milestoneId).toBe(m1.id);

    const foreign = await newTask(p2.id, "b");
    await expect(updateTask({ id: foreign.id, milestoneId: m1.id })).rejects.toBeInstanceOf(PmError);
    await expect(newTask(p2.id, "c", { milestoneId: m1.id })).rejects.toBeInstanceOf(PmError);
  });

  it("unassigns tasks when a milestone is deleted", async () => {
    const p = await newProject();
    const m = await createMilestone({ projectId: p.id, name: "m", targetDate: "2026-06-01" });
    const task = await newTask(p.id, "a", { milestoneId: m.id });
    await deleteMilestone(m.id);
    expect((await getTask(task.id))?.milestoneId).toBeNull();
  });
});

describe("subtasks", () => {
  it("adds in order, toggles, renames and deletes", async () => {
    const p = await newProject();
    const task = await newTask(p.id, "a");
    const s1 = await createSubtask({ taskId: task.id, title: "first" });
    const s2 = await createSubtask({ taskId: task.id, title: "second" });
    expect([s1.position, s2.position]).toEqual([0, 1]);
    expect(s1.done).toBe(false);

    await updateSubtask({ id: s1.id, done: true });
    await updateSubtask({ id: s2.id, title: "renamed" });
    expect((await getTask(task.id))?.subtasks).toMatchObject([
      { title: "first", done: true },
      { title: "renamed", done: false },
    ]);

    await deleteSubtask(s1.id);
    expect((await getTask(task.id))?.subtasks.map((s) => s.title)).toEqual(["renamed"]);
  });

  it("throws for unknown ids", async () => {
    await expect(createSubtask({ taskId: "nope", title: "x" })).rejects.toBeInstanceOf(NotFoundError);
    await expect(updateSubtask({ id: "nope", done: true })).rejects.toBeInstanceOf(NotFoundError);
    await expect(deleteSubtask("nope")).rejects.toBeInstanceOf(NotFoundError);
  });
});

describe("search", () => {
  it("matches titles and descriptions case-insensitively across projects, titles first", async () => {
    const [p1, p2] = [await newProject("One"), await newProject("Two")];
    await newTask(p1.id, "Unrelated", { description: "Mentions the Newsletter in passing" });
    await newTask(p2.id, "Write NEWSLETTER issue");
    await newTask(p2.id, "Something else");

    const results = await searchTasks("newsletter");
    expect(results.map((r) => r.title)).toEqual(["Write NEWSLETTER issue", "Unrelated"]);
    expect(results[0].project.slug).toBe("two");
    expect(results[1].snippet).toContain("Newsletter");
  });

  it("returns nothing for a blank query and treats LIKE wildcards literally", async () => {
    const p = await newProject();
    await newTask(p.id, "Plain title");
    await newTask(p.id, "100% done");
    expect(await searchTasks("   ")).toEqual([]);
    expect((await searchTasks("%")).map((r) => r.title)).toEqual(["100% done"]);
    expect(await searchTasks("_")).toEqual([]);
  });

  it("builds a snippet around the match", () => {
    const text = `${"a".repeat(100)} needle ${"b".repeat(100)}`;
    const snippet = makeSnippet(text, "needle", 10);
    expect(snippet.startsWith("…")).toBe(true);
    expect(snippet.endsWith("…")).toBe(true);
    expect(snippet).toContain("needle");
  });
});

describe("input validation", () => {
  it("trims and requires titles", () => {
    expect(createTaskSchema.parse({ projectId: "p", title: "  hi  " }).title).toBe("hi");
    expect(createTaskSchema.safeParse({ projectId: "p", title: "   " }).success).toBe(false);
    expect(createTaskSchema.safeParse({ projectId: "p", title: "x".repeat(201) }).success).toBe(false);
  });

  it("rejects unknown statuses and priorities", () => {
    expect(updateTaskSchema.safeParse({ id: "t", status: "archived" }).success).toBe(false);
    expect(updateTaskSchema.safeParse({ id: "t", priority: "urgent" }).success).toBe(false);
    expect(updateTaskSchema.safeParse({ id: "t", status: "in_progress", priority: "high" }).success).toBe(true);
  });

  it("rejects impossible dates", () => {
    expect(updateTaskSchema.safeParse({ id: "t", dueDate: "2026-02-30" }).success).toBe(false);
    expect(updateTaskSchema.safeParse({ id: "t", dueDate: "tomorrow" }).success).toBe(false);
    expect(updateTaskSchema.safeParse({ id: "t", dueDate: null }).success).toBe(true);
    expect(createMilestoneSchema.safeParse({ projectId: "p", name: "m", targetDate: "2026-13-01" }).success).toBe(false);
  });

  it("rejects bad move indexes and colors", () => {
    expect(moveTaskSchema.safeParse({ id: "t", status: "todo", index: -1 }).success).toBe(false);
    expect(moveTaskSchema.safeParse({ id: "t", status: "todo", index: 1.5 }).success).toBe(false);
    expect(createProjectSchema.safeParse({ name: "x", color: "red" }).success).toBe(false);
  });
});
