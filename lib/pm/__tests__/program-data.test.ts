import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { createBudgetLine, deleteBudgetLine, listBudgetLines, updateBudgetLine } from "../budget";
import { prisma } from "../db";
import { createMilestone, listMilestones, updateMilestone } from "../milestones";
import { getProgramSnapshot } from "../program";
import { createProject, getProjectById, updateProject } from "../projects";
import { createReport, deleteReport, getReport, listReports, updateReport } from "../reports";
import { createRisk, deleteRisk, listOpenRisks, listRisks, updateRisk } from "../risks";
import { PmNotFoundError, PmValidationError } from "../types";
import { createWorkstream, deleteWorkstream, listWorkstreams, updateWorkstream } from "../workstreams";

beforeEach(async () => {
  await prisma.project.deleteMany();
  await prisma.label.deleteMany();
});
afterAll(() => prisma.$disconnect());

const newProject = (name = "Program") => createProject({ name, color: "#2F6F4E" });

describe("project budget", () => {
  it("stores multi-billion-dollar budgets exactly", async () => {
    const p = await createProject({ name: "Big", color: "#2F6F4E", budget: 7_000_000_000 });
    expect((await getProjectById(p.id))?.budget).toBe(7_000_000_000);
    expect((await updateProject(p.id, { budget: 7_250_000_001 })).budget).toBe(7_250_000_001);
    expect((await newProject("Small")).budget).toBe(0);
    expect(await getProjectById("nope")).toBeNull();
  });
});

describe("workstreams", () => {
  it("creates in order, updates, and lists by order", async () => {
    const p = await newProject();
    const a = await createWorkstream({ projectId: p.id, name: "Engineering", owner: "Sam" });
    const b = await createWorkstream({ projectId: p.id, name: "Construction" });
    expect([a.order, b.order]).toEqual([0, 1]);
    await updateWorkstream(b.id, { owner: "Lee", description: "Civil and structural" });
    expect(await listWorkstreams(p.id)).toMatchObject([
      { name: "Engineering", owner: "Sam" },
      { name: "Construction", owner: "Lee", description: "Civil and structural" },
    ]);
    await expect(createWorkstream({ projectId: "nope", name: "x" })).rejects.toBeInstanceOf(PmNotFoundError);
    await expect(updateWorkstream("nope", { name: "x" })).rejects.toBeInstanceOf(PmNotFoundError);
  });

  it("deleting a workstream removes its budget lines but keeps milestones and risks", async () => {
    const p = await newProject();
    const w = await createWorkstream({ projectId: p.id, name: "Engineering" });
    await createBudgetLine({ workstreamId: w.id, name: "Design", budget: 100 });
    const m = await createMilestone({ projectId: p.id, name: "Design frozen", targetDate: "2027-01-01", workstreamId: w.id });
    const r = await createRisk({ projectId: p.id, title: "Scope creep", workstreamId: w.id });
    await deleteWorkstream(w.id);
    expect(await listBudgetLines(p.id)).toEqual([]);
    expect((await listMilestones(p.id)).find((x) => x.id === m.id)?.workstreamId).toBeNull();
    expect((await listRisks(p.id)).find((x) => x.id === r.id)?.workstreamId).toBeNull();
    await expect(deleteWorkstream(w.id)).rejects.toBeInstanceOf(PmNotFoundError);
  });
});

describe("budget lines", () => {
  it("defaults the forecast to the budget and round-trips large amounts", async () => {
    const p = await newProject();
    const w = await createWorkstream({ projectId: p.id, name: "Equipment" });
    const line = await createBudgetLine({ workstreamId: w.id, name: "Furnace", budget: 2_400_000_000 });
    expect(line).toMatchObject({ budget: 2_400_000_000, committed: 0, spent: 0, forecast: 2_400_000_000, order: 0 });
    const updated = await updateBudgetLine(line.id, { committed: 1_100_000_000, spent: 300_000_000, forecast: 2_550_000_000 });
    expect(updated).toMatchObject({ budget: 2_400_000_000, committed: 1_100_000_000, spent: 300_000_000, forecast: 2_550_000_000 });
    await deleteBudgetLine(line.id);
    expect(await listBudgetLines(p.id)).toEqual([]);
    await expect(createBudgetLine({ workstreamId: "nope", name: "x" })).rejects.toBeInstanceOf(PmNotFoundError);
    await expect(updateBudgetLine(line.id, { spent: 1 })).rejects.toBeInstanceOf(PmNotFoundError);
  });

  it("lists a project's lines in workstream order and not another project's", async () => {
    const p = await newProject();
    const other = await newProject("Other");
    const w1 = await createWorkstream({ projectId: p.id, name: "First" });
    const w2 = await createWorkstream({ projectId: p.id, name: "Second" });
    const ow = await createWorkstream({ projectId: other.id, name: "Elsewhere" });
    await createBudgetLine({ workstreamId: w2.id, name: "c" });
    await createBudgetLine({ workstreamId: w1.id, name: "a" });
    await createBudgetLine({ workstreamId: w1.id, name: "b" });
    await createBudgetLine({ workstreamId: ow.id, name: "z" });
    expect((await listBudgetLines(p.id)).map((l) => l.name)).toEqual(["a", "b", "c"]);
  });
});

describe("milestone baselines and dependencies", () => {
  it("keeps the baseline when the target moves, so slippage is recorded", async () => {
    const p = await newProject();
    const m = await createMilestone({ projectId: p.id, name: "First steel", targetDate: "2027-03-01" });
    expect(m).toMatchObject({ baselineDate: "2027-03-01", completedDate: null, dependsOnIds: [], workstreamId: null });
    const moved = await updateMilestone(m.id, { targetDate: "2027-04-15" });
    expect(moved).toMatchObject({ targetDate: "2027-04-15", baselineDate: "2027-03-01" });
    const rebased = await updateMilestone(m.id, { baselineDate: "2027-04-15" });
    expect(rebased.baselineDate).toBe("2027-04-15");
    const done = await updateMilestone(m.id, { completedDate: "2027-04-10" });
    expect(done.completedDate).toBe("2027-04-10");
    expect((await updateMilestone(m.id, { completedDate: null })).completedDate).toBeNull();
  });

  it("pins the old target as baseline for milestones created before baselines existed", async () => {
    const p = await newProject();
    const row = await prisma.milestone.create({ data: { projectId: p.id, name: "Legacy", targetDate: new Date("2027-01-01T00:00:00Z") } });
    expect((await listMilestones(p.id))[0].baselineDate).toBe("2027-01-01");
    expect(await updateMilestone(row.id, { targetDate: "2027-02-01" })).toMatchObject({ targetDate: "2027-02-01", baselineDate: "2027-01-01" });
  });

  it("sets and replaces dependencies", async () => {
    const p = await newProject();
    const a = await createMilestone({ projectId: p.id, name: "a", targetDate: "2027-01-01" });
    const b = await createMilestone({ projectId: p.id, name: "b", targetDate: "2027-02-01" });
    const c = await createMilestone({ projectId: p.id, name: "c", targetDate: "2027-03-01" });
    expect((await updateMilestone(c.id, { dependsOnIds: [a.id, b.id] })).dependsOnIds.sort()).toEqual([a.id, b.id].sort());
    expect((await updateMilestone(c.id, { dependsOnIds: [b.id] })).dependsOnIds).toEqual([b.id]);
    expect((await listMilestones(p.id)).find((m) => m.id === c.id)?.dependsOnIds).toEqual([b.id]);
  });

  it("rejects self-dependencies, loops, and milestones from other projects", async () => {
    const p = await newProject();
    const other = await newProject("Other");
    const a = await createMilestone({ projectId: p.id, name: "a", targetDate: "2027-01-01" });
    const b = await createMilestone({ projectId: p.id, name: "b", targetDate: "2027-02-01" });
    const c = await createMilestone({ projectId: p.id, name: "c", targetDate: "2027-03-01" });
    const foreign = await createMilestone({ projectId: other.id, name: "x", targetDate: "2027-01-01" });
    await updateMilestone(b.id, { dependsOnIds: [a.id] });
    await updateMilestone(c.id, { dependsOnIds: [b.id] });
    await expect(updateMilestone(a.id, { dependsOnIds: [a.id] })).rejects.toBeInstanceOf(PmValidationError);
    await expect(updateMilestone(a.id, { dependsOnIds: [c.id] })).rejects.toBeInstanceOf(PmValidationError);
    await expect(updateMilestone(a.id, { dependsOnIds: [foreign.id] })).rejects.toBeInstanceOf(PmNotFoundError);
    expect((await listMilestones(p.id)).find((m) => m.id === a.id)?.dependsOnIds).toEqual([]);
  });

  it("rejects a workstream from another project", async () => {
    const p = await newProject();
    const other = await newProject("Other");
    const foreign = await createWorkstream({ projectId: other.id, name: "x" });
    await expect(createMilestone({ projectId: p.id, name: "m", targetDate: "2027-01-01", workstreamId: foreign.id })).rejects.toBeInstanceOf(PmNotFoundError);
  });
});

describe("risks", () => {
  it("creates with defaults, updates, clears the due date, and deletes", async () => {
    const p = await newProject();
    const r = await createRisk({ projectId: p.id, title: "Tariff changes" });
    expect(r).toMatchObject({ kind: "risk", likelihood: 2, impact: 2, status: "open", dueDate: null, owner: "" });
    const updated = await updateRisk(r.id, { kind: "issue", impact: 3, status: "mitigating", owner: "Ana", dueDate: "2026-12-01", mitigation: "Hedge" });
    expect(updated).toMatchObject({ kind: "issue", impact: 3, status: "mitigating", owner: "Ana", dueDate: "2026-12-01", mitigation: "Hedge" });
    expect((await updateRisk(r.id, { dueDate: null })).dueDate).toBeNull();
    await deleteRisk(r.id);
    expect(await listRisks(p.id)).toEqual([]);
    await expect(updateRisk(r.id, { status: "closed" })).rejects.toBeInstanceOf(PmNotFoundError);
    await expect(createRisk({ projectId: "nope", title: "x" })).rejects.toBeInstanceOf(PmNotFoundError);
  });

  it("lists open risks across projects with their project", async () => {
    const p = await newProject();
    const other = await newProject("Other");
    await createRisk({ projectId: p.id, title: "open one" });
    await createRisk({ projectId: p.id, title: "closed one", status: "closed" });
    await createRisk({ projectId: other.id, title: "mitigating one", status: "mitigating" });
    const open = await listOpenRisks();
    expect(open.map((r) => [r.title, r.project.slug])).toEqual([
      ["open one", p.slug],
      ["mitigating one", other.slug],
    ]);
  });
});

describe("reports", () => {
  it("saves, lists newest first, edits and deletes", async () => {
    const p = await newProject();
    const first = await createReport({ projectId: p.id, title: "Week 1", periodStart: "2026-11-10", periodEnd: "2026-11-16", body: "# one" });
    await new Promise((r) => setTimeout(r, 5));
    const second = await createReport({ projectId: p.id, title: "Week 2", periodStart: "2026-11-17", periodEnd: "2026-11-23", body: "# two", source: "assistant" });
    expect(first).toMatchObject({ source: "generated", periodStart: "2026-11-10", periodEnd: "2026-11-16" });
    expect((await listReports(p.id)).map((r) => r.title)).toEqual(["Week 2", "Week 1"]);
    expect((await updateReport(second.id, { body: "# edited" })).body).toBe("# edited");
    expect((await getReport(second.id))?.source).toBe("assistant");
    await deleteReport(first.id);
    expect(await getReport(first.id)).toBeNull();
    await expect(deleteReport(first.id)).rejects.toBeInstanceOf(PmNotFoundError);
  });
});

describe("getProgramSnapshot", () => {
  it("loads a project's data into one roll-up", async () => {
    const p = await createProject({ name: "Program", color: "#2F6F4E", budget: 1000 });
    const w = await createWorkstream({ projectId: p.id, name: "Engineering" });
    await createBudgetLine({ workstreamId: w.id, name: "Design", budget: 400, forecast: 450 });
    await createMilestone({ projectId: p.id, name: "Late one", targetDate: "2026-01-01", workstreamId: w.id });
    await createRisk({ projectId: p.id, title: "Big", likelihood: 3, impact: 3 });
    const snap = await getProgramSnapshot(p, "2026-11-24");
    expect(snap.schedule).toMatchObject({ total: 1, late: 1 });
    expect(snap.budget).toMatchObject({ approved: 1000, budget: 400, forecast: 450, variance: -50, unallocated: 600 });
    expect(snap.risks).toEqual({ open: 1, high: 1, overdue: 0 });
    expect(snap.overall.status).toBe("red");
  });
});
