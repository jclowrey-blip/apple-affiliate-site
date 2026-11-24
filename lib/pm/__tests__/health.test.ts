import { describe, expect, it } from "vitest";
import {
  budgetTotals,
  buildSnapshot,
  isRiskOverdue,
  milestoneStatus,
  riskNeedsAttention,
  riskSeverity,
} from "../health";
import { formatMoney, formatMoneyFull, parseMoney } from "../money";
import { buildStatusReport } from "../report-builder";
import type { BudgetLine, Milestone, Project, Risk, Workstream } from "../types";

const TODAY = "2026-11-24";

const ms = (over: Partial<Milestone> & { id: string }): Milestone => ({
  projectId: "p",
  workstreamId: null,
  name: over.id,
  targetDate: "2027-01-01",
  baselineDate: over.targetDate ?? "2027-01-01",
  completedDate: null,
  dependsOnIds: [],
  ...over,
});
const risk = (over: Partial<Risk> & { id: string }): Risk => ({
  projectId: "p",
  workstreamId: null,
  kind: "risk",
  title: over.id,
  description: "",
  mitigation: "",
  owner: "",
  likelihood: 2,
  impact: 2,
  status: "open",
  dueDate: null,
  createdAt: "2026-11-01T00:00:00.000Z",
  updatedAt: "2026-11-01T00:00:00.000Z",
  ...over,
});
const line = (over: Partial<BudgetLine> & { id: string }): BudgetLine => ({
  workstreamId: "w1",
  name: over.id,
  budget: 0,
  committed: 0,
  spent: 0,
  forecast: 0,
  order: 0,
  ...over,
});
const project: Project = {
  id: "p",
  slug: "p",
  name: "Program",
  description: "",
  color: "#000000",
  status: "active",
  createdAt: "2026-01-01T00:00:00.000Z",
  budget: 0,
};
const ws = (id: string, order = 0): Workstream => ({ id, projectId: "p", name: `WS ${id}`, description: "", owner: "", order });

describe("money", () => {
  it("formats compactly and exactly", () => {
    expect(formatMoney(7_000_000_000)).toBe("$7B");
    expect(formatMoney(1_250_000_000)).toBe("$1.25B");
    expect(formatMoney(350_000_000)).toBe("$350M");
    expect(formatMoney(12_500)).toBe("$12.5K");
    expect(formatMoney(950)).toBe("$950");
    expect(formatMoney(0)).toBe("$0");
    expect(formatMoney(-42_000_000)).toBe("-$42M");
    expect(formatMoneyFull(1_250_000_000)).toBe("$1,250,000,000");
    expect(formatMoneyFull(-500)).toBe("-$500");
  });

  it("parses what people type", () => {
    expect(parseMoney("7B")).toBe(7_000_000_000);
    expect(parseMoney("$1.25 bn")).toBe(1_250_000_000);
    expect(parseMoney("350m")).toBe(350_000_000);
    expect(parseMoney("7 billion")).toBe(7_000_000_000);
    expect(parseMoney("12k")).toBe(12_000);
    expect(parseMoney("$1,250,000")).toBe(1_250_000);
    expect(parseMoney("0")).toBe(0);
    expect(parseMoney(".5m")).toBe(500_000);
  });

  it("rejects things that are not amounts", () => {
    for (const bad of ["", "abc", "-5", "1.2.3", "5x", "1e9", "99999999999999999999"]) expect(parseMoney(bad)).toBeNull();
  });
});

describe("milestoneStatus", () => {
  const status = (m: Milestone, others: Milestone[] = []) =>
    milestoneStatus(m, new Map([m, ...others].map((x) => [x.id, x])), TODAY);

  it("is on track when the target matches the baseline and is in the future", () => {
    expect(status(ms({ id: "a" }))).toMatchObject({ health: "on_track", slipDays: 0, blockedBy: [] });
  });

  it("counts a target on today as not late yet", () => {
    expect(status(ms({ id: "a", targetDate: TODAY })).health).toBe("on_track");
    expect(status(ms({ id: "a", targetDate: "2026-11-23" })).health).toBe("late");
  });

  it("reports slippage in days against the baseline", () => {
    expect(status(ms({ id: "a", baselineDate: "2026-12-01", targetDate: "2026-12-15" }))).toMatchObject({ health: "slipped", slipDays: 14 });
    expect(status(ms({ id: "a", baselineDate: "2026-12-15", targetDate: "2026-12-01" }))).toMatchObject({ health: "on_track", slipDays: -14 });
  });

  it("flags a dependency that is now due after the milestone", () => {
    const dep = ms({ id: "dep", targetDate: "2027-03-01" });
    const result = status(ms({ id: "a", targetDate: "2027-02-01", dependsOnIds: ["dep"] }), [dep]);
    expect(result.health).toBe("conflict");
    expect(result.blockedBy).toEqual([{ id: "dep", name: "dep", targetDate: "2027-03-01" }]);
  });

  it("ignores dependencies that are finished or due in time", () => {
    const done = ms({ id: "done", targetDate: "2027-03-01", completedDate: "2026-11-01" });
    const early = ms({ id: "early", targetDate: "2027-01-15" });
    const sameDay = ms({ id: "same", targetDate: "2027-02-01" });
    expect(status(ms({ id: "a", targetDate: "2027-02-01", dependsOnIds: ["done", "early", "same", "missing"] }), [done, early, sameDay]).health).toBe("on_track");
  });

  it("orders the states: done beats late beats conflict beats slipped", () => {
    const dep = ms({ id: "dep", targetDate: "2027-06-01" });
    const base = { id: "a", baselineDate: "2026-10-01", dependsOnIds: ["dep"] };
    expect(status(ms({ ...base, targetDate: "2026-11-01", completedDate: "2026-11-20" }), [dep])).toMatchObject({ health: "done", blockedBy: [] });
    expect(status(ms({ ...base, targetDate: "2026-11-01" }), [dep]).health).toBe("late");
    expect(status(ms({ ...base, targetDate: "2027-01-01" }), [dep]).health).toBe("conflict");
  });
});

describe("budget and risks", () => {
  it("totals lines and computes variance as budget minus forecast", () => {
    expect(budgetTotals([line({ id: "a", budget: 100, committed: 60, spent: 40, forecast: 120 }), line({ id: "b", budget: 50, committed: 10, spent: 5, forecast: 45 })])).toEqual({
      budget: 150,
      committed: 70,
      spent: 45,
      forecast: 165,
      variance: -15,
    });
    expect(budgetTotals([])).toEqual({ budget: 0, committed: 0, spent: 0, forecast: 0, variance: 0 });
  });

  it("rates severity from likelihood and impact, treating issues as certain", () => {
    expect(riskSeverity(risk({ id: "r", likelihood: 1, impact: 1 }))).toBe("low");
    expect(riskSeverity(risk({ id: "r", likelihood: 1, impact: 3 }))).toBe("medium");
    expect(riskSeverity(risk({ id: "r", likelihood: 2, impact: 2 }))).toBe("medium");
    expect(riskSeverity(risk({ id: "r", likelihood: 2, impact: 3 }))).toBe("high");
    expect(riskSeverity(risk({ id: "r", kind: "issue", likelihood: 1, impact: 2 }))).toBe("high");
    expect(riskSeverity(risk({ id: "r", kind: "issue", likelihood: 1, impact: 1 }))).toBe("medium");
  });

  it("flags open items that are high severity or past due, never closed ones", () => {
    expect(isRiskOverdue(risk({ id: "r", dueDate: "2026-11-23" }), TODAY)).toBe(true);
    expect(isRiskOverdue(risk({ id: "r", dueDate: TODAY }), TODAY)).toBe(false);
    expect(riskNeedsAttention(risk({ id: "r", likelihood: 3, impact: 3 }), TODAY)).toBe(true);
    expect(riskNeedsAttention(risk({ id: "r", likelihood: 1, impact: 1, dueDate: "2026-11-01" }), TODAY)).toBe(true);
    expect(riskNeedsAttention(risk({ id: "r", likelihood: 1, impact: 1 }), TODAY)).toBe(false);
    expect(riskNeedsAttention(risk({ id: "r", likelihood: 3, impact: 3, dueDate: "2026-11-01", status: "closed" }), TODAY)).toBe(false);
  });
});

describe("buildSnapshot", () => {
  const input = () => ({
    project: { ...project, budget: 1000 },
    workstreams: [ws("w1", 0), ws("w2", 1)],
    milestones: [
      ms({ id: "m1", workstreamId: "w1", targetDate: "2026-11-01" }), // late
      ms({ id: "m2", workstreamId: "w1", baselineDate: "2027-01-01", targetDate: "2027-02-01" }), // slipped
      ms({ id: "m3", workstreamId: "w2", completedDate: "2026-11-20" }), // done
      ms({ id: "m4" }), // unassigned, on track
    ],
    budgetLines: [
      line({ id: "l1", workstreamId: "w1", budget: 600, committed: 300, spent: 100, forecast: 650 }),
      line({ id: "l2", workstreamId: "w2", budget: 300, committed: 0, spent: 0, forecast: 300 }),
    ],
    risks: [risk({ id: "r1", workstreamId: "w1", likelihood: 3, impact: 3 }), risk({ id: "r2", status: "closed", likelihood: 3, impact: 3 }), risk({ id: "r3", workstreamId: "gone", dueDate: "2026-11-01", likelihood: 1, impact: 1 })],
    tasks: [
      { status: "done" as const, dueDate: "2026-11-01" },
      { status: "todo" as const, dueDate: "2026-11-01" },
      { status: "todo" as const, dueDate: null },
    ],
    today: TODAY,
  });

  it("groups by workstream and collects unassigned items in a final group", () => {
    const snap = buildSnapshot(input());
    expect(snap.workstreams.map((w) => w.workstream?.id ?? null)).toEqual(["w1", "w2", null]);
    expect(snap.workstreams[0].milestones.map((m) => m.id)).toEqual(["m1", "m2"]);
    expect(snap.workstreams[0].totals.variance).toBe(-50);
    // r3 points at a workstream that no longer exists, so it lands in "unassigned".
    expect(snap.workstreams[2].risks.map((r) => r.id)).toEqual(["r2", "r3"]);
    expect(snap.workstreams[2].milestones.map((m) => m.id)).toEqual(["m4"]);
  });

  it("omits the unassigned group when there is nothing in it", () => {
    const i = input();
    i.milestones = i.milestones.filter((m) => m.workstreamId);
    i.risks = i.risks.filter((r) => r.id === "r1");
    expect(buildSnapshot(i).workstreams.map((w) => w.workstream?.id ?? null)).toEqual(["w1", "w2"]);
  });

  it("rolls up schedule, budget, risk and task counts", () => {
    const snap = buildSnapshot(input());
    expect(snap.schedule).toEqual({ total: 4, done: 1, late: 1, conflict: 0, slipped: 1, on_track: 1 });
    expect(snap.budget).toMatchObject({ approved: 1000, budget: 900, forecast: 950, variance: -50, unallocated: 100 });
    expect(snap.risks).toEqual({ open: 2, high: 1, overdue: 1 });
    expect(snap.tasks).toEqual({ total: 3, done: 1, overdue: 1 });
  });

  it("is red for a late milestone, amber for slippage alone, green when clean", () => {
    expect(buildSnapshot(input()).overall.status).toBe("red");

    const amber = input();
    amber.milestones = amber.milestones.filter((m) => m.id !== "m1");
    const a = buildSnapshot(amber);
    expect(a.overall.status).toBe("amber");
    expect(a.overall.reasons).toContain("1 milestone has slipped from baseline");

    const green = input();
    green.milestones = [ms({ id: "ok" })];
    green.risks = [];
    green.budgetLines = [];
    expect(buildSnapshot(green).overall).toEqual({ status: "green", reasons: [] });
  });

  it("is red when the forecast exceeds the approved budget", () => {
    const i = input();
    i.milestones = [];
    i.risks = [];
    i.project = { ...project, budget: 900 };
    expect(buildSnapshot(i).overall).toEqual({ status: "red", reasons: ["forecast cost exceeds the budget"] });
    // With no approved total, the comparison falls back to the allocated line budgets.
    i.project = { ...project, budget: 0 };
    expect(buildSnapshot(i).overall.status).toBe("red");
    expect(buildSnapshot(i).budget.unallocated).toBeNull();
  });
});

describe("buildStatusReport", () => {
  it("writes every section with figures taken from the snapshot", () => {
    const dep = ms({ id: "Steel delivered", workstreamId: "w1", targetDate: "2027-05-01" });
    const snapshot = buildSnapshot({
      project: { ...project, budget: 7_000_000_000 },
      workstreams: [ws("w1")],
      milestones: [
        dep,
        ms({ id: "Furnace commissioned", workstreamId: "w1", baselineDate: "2027-03-01", targetDate: "2027-04-01", dependsOnIds: [dep.id] }),
        ms({ id: "Permits granted", workstreamId: "w1", targetDate: "2026-11-01" }),
        ms({ id: "Design frozen", workstreamId: "w1", targetDate: "2026-11-15", completedDate: "2026-11-20" }),
        ms({ id: "Site handover", targetDate: "2026-12-10" }),
      ],
      budgetLines: [line({ id: "Equipment | long lead", budget: 2_000_000_000, committed: 1_000_000_000, spent: 250_000_000, forecast: 2_150_000_000 })],
      risks: [
        risk({ id: "Supplier slips", likelihood: 3, impact: 3, owner: "Dana", mitigation: "Second source", dueDate: "2026-11-10", createdAt: "2026-11-19T10:00:00.000Z" }),
        risk({ id: "Old closed risk", status: "closed", likelihood: 3, impact: 3 }),
      ],
      tasks: [{ status: "done", dueDate: null }, { status: "todo", dueDate: "2026-11-01" }],
      today: TODAY,
    });
    const report = buildStatusReport(snapshot, { start: "2026-11-17", end: "2026-11-24" });

    expect(report).toContain("# Program status report, Nov 24, 2026");
    expect(report).toContain("Period: Nov 17, 2026 to Nov 24, 2026.");
    expect(report).toContain("**Status: Red.**");
    expect(report).toContain("5 milestones: 1 done, 2 on track, 0 slipped, 1 with a dependency conflict, 1 late.");
    expect(report).toContain("- **Design frozen** (WS w1); completed Nov 20, 2026");
    expect(report).toContain("- **Permits granted** (WS w1); target Nov 1, 2026");
    expect(report).toContain("- **Furnace commissioned** (WS w1); target Apr 1, 2027; 31 days later than baseline Mar 1, 2027; waiting on Steel delivered (May 1, 2027)");
    expect(report).toContain("- **Site handover** (no workstream); target Dec 10, 2026");
    expect(report).toContain("Approved budget $7B; $2B allocated to budget lines ($5B unallocated).");
    expect(report).toContain("| WS w1 | $2B | $1B | $250M | $2.15B | -$150M |");
    expect(report).toContain("- **Equipment | long lead** (WS w1): forecast $2.15B against a budget of $2B, $150M over");
    expect(report).toContain("1 open: 1 high severity, 1 past the due date.");
    expect(report).toContain("- **Supplier slips**; Risk, high severity; open; owner Dana; was due Nov 10, 2026\n  - Mitigation: Second source");
    expect(report).toContain("### Raised this period\n\n- **Supplier slips** (Risk; likelihood high, impact high)");
    expect(report).not.toContain("Old closed risk");
    expect(report).toContain("1 of 2 tasks done; 1 overdue.");
  });

  it("says so plainly when nothing has been entered", () => {
    const report = buildStatusReport(buildSnapshot({ project, workstreams: [], milestones: [], budgetLines: [], risks: [], tasks: [], today: TODAY }), { start: TODAY, end: TODAY });
    expect(report).toContain("**Status: Green.**");
    expect(report).toContain("No milestones are being tracked yet.");
    expect(report).toContain("No budget has been entered yet.");
    expect(report).toContain("Nothing has been logged in the register yet.");
    expect(report).toContain("No tasks are being tracked yet.");
  });
});
