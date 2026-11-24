import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { assistantTools, executeTool } from "../assistant/tools";
import { createBudgetLine, listBudgetLines } from "../budget";
import { prisma } from "../db";
import { createMilestone, listMilestones } from "../milestones";
import { createProject } from "../projects";
import { listReports } from "../reports";
import { listRisks } from "../risks";
import { createTask, listTasks } from "../tasks";
import { createWorkstream } from "../workstreams";

beforeEach(async () => {
  await prisma.project.deleteMany();
  await prisma.label.deleteMany();
});
afterAll(() => prisma.$disconnect());

async function program() {
  const p = await createProject({ name: "Big Program", color: "#2F6F4E", budget: 1_000_000_000 });
  const ws = await createWorkstream({ projectId: p.id, name: "Engineering" });
  const line = await createBudgetLine({ workstreamId: ws.id, name: "Design", budget: 400_000_000 });
  const first = await createMilestone({ projectId: p.id, name: "Design frozen", targetDate: "2027-03-01", workstreamId: ws.id });
  const second = await createMilestone({ projectId: p.id, name: "Permits granted", targetDate: "2027-06-01", workstreamId: ws.id });
  return { p, ws, line, first, second };
}

const call = async (name: string, input: unknown) => {
  const outcome = await executeTool(name, input);
  return { ...outcome, data: outcome.ok ? JSON.parse(outcome.content) : null };
};

describe("assistant tool definitions", () => {
  it("have unique names, descriptions, and no delete tools", () => {
    const names = assistantTools.map((t) => t.name);
    expect(new Set(names).size).toBe(names.length);
    for (const t of assistantTools) {
      expect(t.description.length).toBeGreaterThan(20);
      expect(t.label.length).toBeGreaterThan(0);
      expect(t.name).not.toMatch(/delete|remove/);
    }
  });

  it("mark exactly the writing tools as mutating", () => {
    const writes = assistantTools.filter((t) => t.mutates).map((t) => t.name).sort();
    expect(writes).toEqual(
      [
        "add_note",
        "create_budget_line",
        "create_milestone",
        "create_risk",
        "create_task",
        "create_workstream",
        "draft_team_message",
        "finish_day",
        "save_status_report",
        "update_budget_line",
        "update_milestone",
        "update_risk",
        "update_task",
        "update_workstream",
      ].sort(),
    );
  });
});

describe("read tools", () => {
  it("list projects and return the full program status with ids", async () => {
    const { p, ws, line, first } = await program();
    const projects = await call("list_projects", {});
    expect(projects.mutated).toBe(false);
    expect(projects.data).toMatchObject([{ slug: p.slug, name: "Big Program", approvedBudget: 1_000_000_000 }]);

    const status = await call("get_program_status", { project: p.slug });
    expect(status.data.budget).toMatchObject({ approved: 1_000_000_000, budget: 400_000_000, unallocated: 600_000_000 });
    expect(status.data.workstreams[0].workstream.id).toBe(ws.id);
    expect(status.data.workstreams[0].budgetLines[0].id).toBe(line.id);
    expect(status.data.workstreams[0].milestones.map((m: { id: string }) => m.id)).toContain(first.id);
  });

  it("filter tasks by status and by overdue", async () => {
    const { p } = await program();
    await createTask({ projectId: p.id, title: "old", status: "todo", dueDate: "2020-01-01" });
    await createTask({ projectId: p.id, title: "old but done", status: "done", dueDate: "2020-01-01" });
    await createTask({ projectId: p.id, title: "future", status: "todo", dueDate: "2999-01-01" });
    expect((await call("list_tasks", { project: p.slug })).data).toHaveLength(3);
    expect((await call("list_tasks", { project: p.slug, status: "done" })).data.map((t: { title: string }) => t.title)).toEqual(["old but done"]);
    expect((await call("list_tasks", { project: p.slug, overdueOnly: true })).data.map((t: { title: string }) => t.title)).toEqual(["old"]);
    expect((await call("search_tasks", { query: "futur" })).data[0].title).toBe("future");
  });
});

describe("write tools", () => {
  it("create and update a task", async () => {
    const { p, first } = await program();
    const created = await call("create_task", { project: p.slug, title: "Review drawings", priority: "high", dueDate: "2027-01-15", labels: ["Design"], milestoneId: first.id });
    expect(created.mutated).toBe(true);
    expect(created.data).toMatchObject({ title: "Review drawings", status: "backlog", priority: "high", labels: ["design"], milestoneId: first.id });
    const updated = await call("update_task", { taskId: created.data.id, status: "in_progress", dueDate: null });
    expect(updated.data).toMatchObject({ status: "in_progress", dueDate: null, priority: "high" });
    expect((await listTasks(p.id))[0].status).toBe("in_progress");
  });

  it("move a milestone without touching its baseline, then set dependencies and completion", async () => {
    const { p, first, second } = await program();
    const moved = await call("update_milestone", { milestoneId: first.id, targetDate: "2027-04-12" });
    expect(moved.data).toMatchObject({ targetDate: "2027-04-12", baselineDate: "2027-03-01" });
    await call("update_milestone", { milestoneId: second.id, dependsOnIds: [first.id] });
    await call("update_milestone", { milestoneId: first.id, completedDate: "2027-04-10" });
    const all = await listMilestones(p.id);
    expect(all.find((m) => m.id === second.id)?.dependsOnIds).toEqual([first.id]);
    expect(all.find((m) => m.id === first.id)?.completedDate).toBe("2027-04-10");
  });

  it("update budget amounts and add workstreams, lines and milestones", async () => {
    const { p, line } = await program();
    const updated = await call("update_budget_line", { budgetLineId: line.id, forecast: 450_000_000, spent: 120_000_000 });
    expect(updated.data).toMatchObject({ budget: 400_000_000, forecast: 450_000_000, spent: 120_000_000 });
    const ws = await call("create_workstream", { project: p.slug, name: "Construction", owner: "Lee" });
    const newLine = await call("create_budget_line", { workstreamId: ws.data.id, name: "Civil works", budget: 250_000_000 });
    expect(newLine.data).toMatchObject({ budget: 250_000_000, forecast: 250_000_000 });
    const ms = await call("create_milestone", { project: p.slug, name: "Ground broken", targetDate: "2027-09-01", workstreamId: ws.data.id });
    expect(ms.data).toMatchObject({ workstreamId: ws.data.id, baselineDate: "2027-09-01" });
    expect(await listBudgetLines(p.id)).toHaveLength(2);
  });

  it("log and update a risk", async () => {
    const { p, ws } = await program();
    const created = await call("create_risk", { project: p.slug, title: "Supplier delay", likelihood: 3, impact: 3, owner: "Ana", workstreamId: ws.id });
    expect(created.data).toMatchObject({ kind: "risk", likelihood: 3, impact: 3, status: "open" });
    await call("update_risk", { riskId: created.data.id, status: "mitigating", mitigation: "Second source" });
    expect((await listRisks(p.id))[0]).toMatchObject({ status: "mitigating", mitigation: "Second source", owner: "Ana" });
  });

  it("build a report from the data and save an edited version", async () => {
    const { p } = await program();
    const built = await executeTool("build_status_report", { project: p.slug, periodStart: "2026-11-17", periodEnd: "2026-11-24" });
    expect(built).toMatchObject({ ok: true, mutated: false });
    expect(built.content).toContain("# Big Program status report, Nov 24, 2026");
    expect(built.content).toContain("Approved budget $1B");

    const saved = await call("save_status_report", { project: p.slug, title: "Week 47", periodStart: "2026-11-17", periodEnd: "2026-11-24", body: `${built.content}\nNarrative.` });
    expect(saved).toMatchObject({ mutated: true, data: { title: "Week 47", saved: true } });
    expect(await listReports(p.id)).toMatchObject([{ title: "Week 47", source: "assistant" }]);
    expect((await call("list_status_reports", { project: p.slug })).data).toHaveLength(1);
    expect((await call("get_status_report", { reportId: saved.data.id })).data.body).toContain("Narrative.");
  });
});

describe("daily loop tools", () => {
  it("run a check-in end to end: read, update, note, finish, and draft a custom message", async () => {
    const { p, ws, first, second } = await program();
    await call("update_milestone", { milestoneId: second.id, dependsOnIds: [first.id] });
    const { createMember } = await import("../team");
    const member = await createMember({ projectId: p.id, name: "Dana Reyes", email: "dana@example.com", workstreamId: ws.id });

    const checkin = await call("get_daily_checkin", { project: p.slug });
    expect(checkin.mutated).toBe(false);
    expect(checkin.data.workstreams).toMatchObject([{ id: ws.id, percentComplete: 0 }]);
    expect(checkin.data.team).toMatchObject([{ id: member.id, name: "Dana Reyes", hasEmail: true }]);

    const progress = await call("update_workstream", { workstreamId: ws.id, percentComplete: 35, plannedStart: "2026-01-01", plannedFinish: "2027-12-31" });
    expect(progress.data).toMatchObject({ percentComplete: 35, plannedStart: "2026-01-01" });
    await call("update_milestone", { milestoneId: first.id, targetDate: "2027-03-15" });
    expect((await call("add_note", { project: p.slug, text: "Sponsor asked for a recovery plan" })).mutated).toBe(true);

    const perf = await call("get_schedule_and_cost_performance", { project: p.slug });
    expect(perf.data.schedule).toMatchObject({ baselineFinish: "2027-06-01", projectedFinish: "2027-06-15", finishSlipDays: 14, criticalPath: ["Design frozen", "Permits granted"] });
    expect(perf.data.earnedValue.total).toMatchObject({ bac: 400_000_000, ev: 140_000_000, percentComplete: 35 });

    const again = await call("get_daily_checkin", { project: p.slug });
    expect(again.data.alreadyRecordedToday.map((a: { summary: string }) => a.summary)).toEqual(
      expect.arrayContaining(["Engineering: progress 0% to 35%", "Sponsor asked for a recovery plan", expect.stringContaining("Milestone Design frozen: target moved from Mar 1, 2027 to Mar 15, 2027 (14 days later)")]),
    );

    const finished = await call("finish_day", { project: p.slug, notes: "Wrap-up note" });
    expect(finished.mutated).toBe(true);
    expect(finished.data.summary).toContain("- Engineering: progress 0% to 35%");
    expect(finished.data.summary).toContain("- Wrap-up note");
    expect(finished.data.summary).toContain("(14 days later)");
    expect(finished.data.messagesDrafted).toMatchObject([{ to: "Dana Reyes", kind: "update_request" }, { to: "Whole team", kind: "summary" }]);
    expect((await listReports(p.id))[0]).toMatchObject({ kind: "daily", source: "generated" });

    const custom = await call("draft_team_message", { project: p.slug, memberId: member.id, subject: "Recovery plan", body: "Dana, please send the recovery plan by Friday." });
    expect(custom.data).toMatchObject({ to: "Dana Reyes", saved: true, sent: false });
    const messages = await call("list_team_messages", { project: p.slug });
    expect(messages.data.map((m: { status: string }) => m.status)).toEqual(["draft", "draft", "draft"]);

    // Finishing again replaces the auto-drafts but keeps the assistant's own message.
    await call("finish_day", { project: p.slug });
    const after = await call("list_team_messages", { project: p.slug });
    expect(after.data.map((m: { subject: string }) => m.subject).filter((s: string) => s === "Recovery plan")).toHaveLength(1);
    expect(after.data).toHaveLength(3);
  });

  it("rejects out-of-range progress and messages with no recipient", async () => {
    const { p, ws } = await program();
    expect(await executeTool("update_workstream", { workstreamId: ws.id, percentComplete: 140 })).toMatchObject({ ok: false, mutated: false });
    expect(await executeTool("update_workstream", { workstreamId: ws.id, plannedStart: "2027-06-01", plannedFinish: "2027-01-01" })).toMatchObject({ ok: false, content: expect.stringContaining("before planned finish") });
    expect(await executeTool("draft_team_message", { project: p.slug, subject: "x", body: "y" })).toMatchObject({ ok: false, content: expect.stringContaining("memberId or a recipient") });
    expect(await executeTool("draft_team_message", { project: p.slug, memberId: "nope", subject: "x", body: "y" })).toMatchObject({ ok: false, content: expect.stringContaining("Team member not found") });
  });
});

describe("errors come back as messages, never as exceptions or silent writes", () => {
  it("unknown tool, unknown project, unknown record", async () => {
    await program();
    expect(await executeTool("delete_project", {})).toMatchObject({ ok: false, mutated: false, content: expect.stringContaining("no tool named") });
    expect(await executeTool("get_program_status", { project: "nope" })).toMatchObject({ ok: false, content: expect.stringContaining('Project "nope" not found') });
    expect(await executeTool("update_task", { taskId: "nope", title: "x" })).toMatchObject({ ok: false, mutated: false, content: expect.stringContaining("Task not found") });
  });

  it("invalid input is rejected before anything is written", async () => {
    const { p, line, first } = await program();
    expect(await executeTool("create_task", { project: p.slug })).toMatchObject({ ok: false, content: expect.stringContaining("title") });
    expect(await executeTool("create_task", { project: p.slug, title: "x", dueDate: "next Friday" })).toMatchObject({ ok: false, mutated: false });
    expect(await executeTool("update_budget_line", { budgetLineId: line.id, forecast: -5 })).toMatchObject({ ok: false, mutated: false });
    expect(await executeTool("update_budget_line", { budgetLineId: line.id, forecast: "450M" })).toMatchObject({ ok: false, mutated: false });
    expect(await executeTool("create_risk", { project: p.slug, title: "x", likelihood: 7 })).toMatchObject({ ok: false, mutated: false });
    expect(await executeTool("update_milestone", { milestoneId: first.id, dependsOnIds: [first.id] })).toMatchObject({ ok: false, content: expect.stringContaining("can't depend on itself") });
    expect(await listTasks(p.id)).toEqual([]);
    expect((await listBudgetLines(p.id))[0].forecast).toBe(400_000_000);
    expect(await listRisks(p.id)).toEqual([]);
  });
});
