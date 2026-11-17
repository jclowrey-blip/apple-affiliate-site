import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "../db";
import { createMilestone, deleteMilestone, listMilestones, updateMilestone } from "../milestones";
import { createProject, deleteProject, getProjectBySlug, listProjects, slugify, updateProject } from "../projects";
import { columnOf } from "../reorder";
import { searchTasks } from "../search";
import { createSubtask, deleteSubtask, updateSubtask } from "../subtasks";
import { createTask, deleteTask, getTask, listOpenTasksDueBy, listTasks, moveTask, updateTask } from "../tasks";
import { PmNotFoundError, type TaskStatus } from "../types";

beforeEach(async () => {
  await prisma.subtask.deleteMany();
  await prisma.task.deleteMany();
  await prisma.label.deleteMany();
  await prisma.milestone.deleteMany();
  await prisma.project.deleteMany();
});

afterAll(() => prisma.$disconnect());

const newProject = (name = "Site") => createProject({ name, color: "#2F6F4E" });

async function columnTitles(projectId: string, status: TaskStatus) {
  return columnOf(await listTasks(projectId), status).map((t) => t.title);
}

describe("projects", () => {
  it("slugifies names", () => {
    expect(slugify("  Orchard Storefront! ")).toBe("orchard-storefront");
    expect(slugify("???")).toBe("project");
  });

  it("creates projects with unique slugs and reads them back by slug", async () => {
    const a = await newProject("Home Lab");
    const b = await newProject("Home lab");
    const c = await newProject("Home-Lab");
    expect([a.slug, b.slug, c.slug]).toEqual(["home-lab", "home-lab-2", "home-lab-3"]);
    expect((await getProjectBySlug("home-lab-2"))?.id).toBe(b.id);
    expect(await getProjectBySlug("missing")).toBeNull();
  });

  it("reports done / total progress per project", async () => {
    const p = await newProject();
    await newProject("Empty");
    await createTask({ projectId: p.id, title: "one", status: "done" });
    await createTask({ projectId: p.id, title: "two", status: "todo" });
    await createTask({ projectId: p.id, title: "three", status: "done" });
    const [site, empty] = await listProjects();
    expect([site.doneTasks, site.totalTasks]).toEqual([2, 3]);
    expect([empty.doneTasks, empty.totalTasks]).toEqual([0, 0]);
  });

  it("updates fields but keeps the slug stable on rename", async () => {
    const p = await newProject("Old name");
    const updated = await updateProject(p.id, { name: "New name", status: "on_hold" });
    expect(updated).toMatchObject({ name: "New name", status: "on_hold", slug: "old-name" });
  });

  it("deletes a project with everything under it", async () => {
    const p = await newProject();
    const m = await createMilestone({ projectId: p.id, name: "v1", targetDate: "2026-12-01" });
    const t = await createTask({ projectId: p.id, title: "task", labels: ["x"], milestoneId: m.id });
    await createSubtask(t.id, "sub");
    await deleteProject(p.id);
    expect(await prisma.task.count()).toBe(0);
    expect(await prisma.subtask.count()).toBe(0);
    expect(await prisma.milestone.count()).toBe(0);
    expect(await prisma.label.count()).toBe(0);
    await expect(deleteProject(p.id)).rejects.toBeInstanceOf(PmNotFoundError);
  });
});

describe("tasks", () => {
  it("creates tasks with defaults at the end of their column", async () => {
    const p = await newProject();
    const a = await createTask({ projectId: p.id, title: "a" });
    const b = await createTask({ projectId: p.id, title: "b" });
    const c = await createTask({ projectId: p.id, title: "c", status: "todo" });
    expect(a).toMatchObject({ status: "backlog", priority: "medium", dueDate: null, order: 0, labels: [] });
    expect(b.order).toBe(1);
    expect(c.order).toBe(0);
  });

  it("round-trips all fields, including date-only due dates and labels", async () => {
    const p = await newProject();
    const m = await createMilestone({ projectId: p.id, name: "v1", targetDate: "2026-12-01" });
    const created = await createTask({
      projectId: p.id,
      title: "Write guide",
      description: "**bold**",
      status: "in_progress",
      priority: "high",
      dueDate: "2026-11-30",
      labels: ["content", "seo"],
      milestoneId: m.id,
    });
    const read = await getTask(created.id);
    expect(read).toMatchObject({
      title: "Write guide",
      description: "**bold**",
      status: "in_progress",
      priority: "high",
      dueDate: "2026-11-30",
      labels: ["content", "seo"],
      milestoneId: m.id,
      project: { slug: p.slug },
    });
  });

  it("rejects tasks for missing projects and milestones from other projects", async () => {
    const p = await newProject();
    const other = await newProject("Other");
    const foreign = await createMilestone({ projectId: other.id, name: "x", targetDate: "2026-12-01" });
    await expect(createTask({ projectId: "nope", title: "x" })).rejects.toBeInstanceOf(PmNotFoundError);
    await expect(createTask({ projectId: p.id, title: "x", milestoneId: foreign.id })).rejects.toBeInstanceOf(
      PmNotFoundError,
    );
    const t = await createTask({ projectId: p.id, title: "x" });
    await expect(updateTask(t.id, { milestoneId: foreign.id })).rejects.toBeInstanceOf(PmNotFoundError);
  });

  it("updates fields, replaces labels and clears nullable fields", async () => {
    const p = await newProject();
    const t = await createTask({ projectId: p.id, title: "t", dueDate: "2026-11-20", labels: ["a", "b"] });
    const updated = await updateTask(t.id, { title: "renamed", priority: "low", dueDate: null, labels: ["b", "c"] });
    expect(updated).toMatchObject({ title: "renamed", priority: "low", dueDate: null, labels: ["b", "c"] });
    // "a" is no longer used by any task, so it is cleaned up.
    expect((await prisma.label.findMany()).map((l) => l.name).sort()).toEqual(["b", "c"]);
    await expect(updateTask("nope", { title: "x" })).rejects.toBeInstanceOf(PmNotFoundError);
  });

  it("puts a task at the end of the new column when its status is edited", async () => {
    const p = await newProject();
    const a = await createTask({ projectId: p.id, title: "a", status: "todo" });
    await createTask({ projectId: p.id, title: "b", status: "todo" });
    await createTask({ projectId: p.id, title: "x", status: "done" });
    const moved = await updateTask(a.id, { status: "done" });
    expect(moved).toMatchObject({ status: "done", order: 1 });
    expect(await columnTitles(p.id, "done")).toEqual(["x", "a"]);
    expect(columnOf(await listTasks(p.id), "todo").map((t) => t.order)).toEqual([0]);
  });

  it("persists reordering within a column", async () => {
    const p = await newProject();
    const [a] = await Promise.all([createTask({ projectId: p.id, title: "a", status: "todo" })]);
    await createTask({ projectId: p.id, title: "b", status: "todo" });
    await createTask({ projectId: p.id, title: "c", status: "todo" });
    await moveTask(a.id, "todo", 2);
    expect(await columnTitles(p.id, "todo")).toEqual(["b", "c", "a"]);
    await moveTask(a.id, "todo", 1);
    expect(await columnTitles(p.id, "todo")).toEqual(["b", "a", "c"]);
  });

  it("persists moves between columns at a specific position", async () => {
    const p = await newProject();
    await createTask({ projectId: p.id, title: "a", status: "todo" });
    const b = await createTask({ projectId: p.id, title: "b", status: "todo" });
    await createTask({ projectId: p.id, title: "c", status: "todo" });
    await createTask({ projectId: p.id, title: "x", status: "in_progress" });
    await createTask({ projectId: p.id, title: "y", status: "in_progress" });
    const moved = await moveTask(b.id, "in_progress", 1);
    expect(moved).toMatchObject({ status: "in_progress", order: 1 });
    expect(await columnTitles(p.id, "todo")).toEqual(["a", "c"]);
    expect(await columnTitles(p.id, "in_progress")).toEqual(["x", "b", "y"]);
    expect(columnOf(await listTasks(p.id), "todo").map((t) => t.order)).toEqual([0, 1]);
  });

  it("does not reorder tasks in other projects", async () => {
    const p = await newProject();
    const other = await newProject("Other");
    const a = await createTask({ projectId: p.id, title: "a", status: "todo" });
    await createTask({ projectId: other.id, title: "o1", status: "done" });
    await createTask({ projectId: other.id, title: "o2", status: "done" });
    await moveTask(a.id, "done", 0);
    expect(await columnTitles(other.id, "done")).toEqual(["o1", "o2"]);
    expect(columnOf(await listTasks(other.id), "done").map((t) => t.order)).toEqual([0, 1]);
    await expect(moveTask("nope", "done", 0)).rejects.toBeInstanceOf(PmNotFoundError);
  });

  it("deletes a task and its subtasks", async () => {
    const p = await newProject();
    const t = await createTask({ projectId: p.id, title: "t", labels: ["only-here"] });
    await createSubtask(t.id, "s");
    await deleteTask(t.id);
    expect(await getTask(t.id)).toBeNull();
    expect(await prisma.subtask.count()).toBe(0);
    expect(await prisma.label.count()).toBe(0);
    await expect(deleteTask(t.id)).rejects.toBeInstanceOf(PmNotFoundError);
  });

  it("lists unfinished tasks due by a date across projects, soonest first", async () => {
    const p = await newProject();
    const other = await newProject("Other");
    await createTask({ projectId: p.id, title: "later", dueDate: "2026-11-25" });
    await createTask({ projectId: other.id, title: "overdue", dueDate: "2026-11-10" });
    await createTask({ projectId: p.id, title: "on the day", dueDate: "2026-11-22" });
    await createTask({ projectId: p.id, title: "finished", dueDate: "2026-11-12", status: "done" });
    await createTask({ projectId: p.id, title: "no date" });
    const due = await listOpenTasksDueBy("2026-11-22");
    expect(due.map((t) => t.title)).toEqual(["overdue", "on the day"]);
    expect(due[0].project.slug).toBe(other.slug);
  });
});

describe("subtasks", () => {
  it("adds, toggles, renames and deletes subtasks in order", async () => {
    const p = await newProject();
    const t = await createTask({ projectId: p.id, title: "t" });
    const s1 = await createSubtask(t.id, "first");
    const s2 = await createSubtask(t.id, "second");
    expect([s1.order, s2.order]).toEqual([0, 1]);

    expect((await updateSubtask(s1.id, { done: true })).done).toBe(true);
    expect((await updateSubtask(s2.id, { title: "renamed" })).title).toBe("renamed");
    expect((await getTask(t.id))?.subtasks.map((s) => [s.title, s.done])).toEqual([
      ["first", true],
      ["renamed", false],
    ]);

    await deleteSubtask(s1.id);
    expect((await getTask(t.id))?.subtasks.map((s) => s.title)).toEqual(["renamed"]);
    await expect(updateSubtask(s1.id, { done: false })).rejects.toBeInstanceOf(PmNotFoundError);
    await expect(createSubtask("nope", "x")).rejects.toBeInstanceOf(PmNotFoundError);
  });
});

describe("milestones", () => {
  it("lists milestones by target date and updates them", async () => {
    const p = await newProject();
    const late = await createMilestone({ projectId: p.id, name: "late", targetDate: "2027-01-10" });
    await createMilestone({ projectId: p.id, name: "early", targetDate: "2026-12-01" });
    expect((await listMilestones(p.id)).map((m) => m.name)).toEqual(["early", "late"]);
    await updateMilestone(late.id, { name: "sooner", targetDate: "2026-11-20" });
    expect(await listMilestones(p.id)).toMatchObject([
      { name: "sooner", targetDate: "2026-11-20" },
      { name: "early", targetDate: "2026-12-01" },
    ]);
  });

  it("keeps tasks but un-assigns them when a milestone is deleted", async () => {
    const p = await newProject();
    const m = await createMilestone({ projectId: p.id, name: "v1", targetDate: "2026-12-01" });
    const t = await createTask({ projectId: p.id, title: "t", milestoneId: m.id });
    await deleteMilestone(m.id);
    expect((await getTask(t.id))?.milestoneId).toBeNull();
    await expect(deleteMilestone(m.id)).rejects.toBeInstanceOf(PmNotFoundError);
  });
});

describe("search", () => {
  it("matches titles and descriptions case-insensitively, titles first", async () => {
    const p = await newProject();
    await createTask({ projectId: p.id, title: "Unrelated", description: "Remember the Backup rotation policy" });
    await createTask({ projectId: p.id, title: "Automate nightly BACKUPS" });
    await createTask({ projectId: p.id, title: "Something else" });
    const results = await searchTasks("backup");
    expect(results.map((r) => r.title)).toEqual(["Automate nightly BACKUPS", "Unrelated"]);
    expect(results[1].snippet).toContain("Backup rotation");
    expect(results[0].project.slug).toBe(p.slug);
    expect(await searchTasks("   ")).toEqual([]);
    expect(await searchTasks("zzz")).toEqual([]);
  });
});
