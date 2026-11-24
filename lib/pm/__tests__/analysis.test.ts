import { describe, expect, it } from "vitest";
import { analyzeSchedule } from "../critical-path";
import { activityOn, buildDailyCheckin, buildDailySummary, buildTeamMessages, markdownToPlain } from "../daily";
import { buildSnapshot } from "../health";
import { buildPerformance, formatIndex, plannedFraction } from "../performance";
import type { Activity, BudgetLine, Milestone, Project, Risk, TeamMember, Workstream } from "../types";

const TODAY = "2026-11-24";

const ms = (id: string, baseline: string, over: Partial<Milestone> = {}): Milestone => ({
  id,
  projectId: "p",
  workstreamId: null,
  name: id,
  baselineDate: baseline,
  targetDate: baseline,
  completedDate: null,
  dependsOnIds: [],
  ...over,
});
const node = (a: ReturnType<typeof analyzeSchedule>, id: string) => a.nodes.find((n) => n.id === id)!;

describe("analyzeSchedule", () => {
  // A (Jan 1) -> B (Mar 1) -> D (Jun 1)
  //            \ C (Feb 1) /        C has 28 days of float against B
  const network = (over: Record<string, Partial<Milestone>> = {}) => [
    ms("A", "2027-01-01", over.A),
    ms("B", "2027-03-01", { dependsOnIds: ["A"], ...over.B }),
    ms("C", "2027-02-01", { dependsOnIds: ["A"], ...over.C }),
    ms("D", "2027-06-01", { dependsOnIds: ["B", "C"], ...over.D }),
  ];

  it("reproduces the baseline when nothing has moved", () => {
    const a = analyzeSchedule(network(), TODAY);
    expect(a.baselineFinish).toBe("2027-06-01");
    expect(a.forecastFinish).toBe("2027-06-01");
    expect(a.finishSlipDays).toBe(0);
    expect(a.nodes.map((n) => [n.id, n.forecastDate])).toEqual([
      ["A", "2027-01-01"],
      ["C", "2027-02-01"],
      ["B", "2027-03-01"],
      ["D", "2027-06-01"],
    ]);
  });

  it("takes durations from the baseline gap after the latest predecessor", () => {
    const a = analyzeSchedule(network(), TODAY);
    expect(node(a, "A").durationDays).toBeNull();
    expect(node(a, "B").durationDays).toBe(59);
    expect(node(a, "C").durationDays).toBe(31);
    expect(node(a, "D").durationDays).toBe(92); // Mar 1 -> Jun 1
  });

  it("finds the critical path and gives float to the branch with slack", () => {
    const a = analyzeSchedule(network(), TODAY);
    expect(a.criticalPath).toEqual(["A", "B", "D"]);
    expect(node(a, "C")).toMatchObject({ floatDays: 28, critical: false });
    for (const id of ["A", "B", "D"]) expect(node(a, id)).toMatchObject({ floatDays: 0, critical: true });
  });

  it("pushes a slip on the critical path through to the finish, day for day", () => {
    const a = analyzeSchedule(network({ B: { targetDate: "2027-03-31" } }), TODAY);
    expect(node(a, "B").forecastSlipDays).toBe(30);
    expect(node(a, "D")).toMatchObject({ forecastDate: "2027-07-01", drivenById: "B" });
    expect(a.forecastFinish).toBe("2027-07-01");
    expect(a.finishSlipDays).toBe(30);
    expect(node(a, "C").floatDays).toBe(58); // its slack grew by the same 30 days
  });

  it("absorbs a slip that fits inside the float, then switches the critical path when it doesn't", () => {
    const within = analyzeSchedule(network({ C: { targetDate: "2027-02-20" } }), TODAY);
    expect(within.forecastFinish).toBe("2027-06-01");
    expect(within.criticalPath).toEqual(["A", "B", "D"]);
    expect(node(within, "C").floatDays).toBe(9);

    const beyond = analyzeSchedule(network({ C: { targetDate: "2027-03-15" } }), TODAY);
    expect(beyond.forecastFinish).toBe("2027-06-15");
    expect(beyond.finishSlipDays).toBe(14);
    // C is late on its own account, not because of A, so the path starts at C
    // and A now has room to slip too.
    expect(beyond.criticalPath).toEqual(["C", "D"]);
    expect(node(beyond, "B")).toMatchObject({ floatDays: 14, critical: false });
    expect(node(beyond, "A")).toMatchObject({ floatDays: 14, critical: false }); // limited by B, which also has 14
  });

  it("uses completed dates, and an early finish pulls the forecast in only as far as targets allow", () => {
    const a = analyzeSchedule(network({ A: { completedDate: "2026-12-20" } }), "2026-12-25");
    expect(node(a, "A")).toMatchObject({ forecastDate: "2026-12-20", critical: false, floatDays: 0 });
    expect(node(a, "B").forecastDate).toBe("2027-03-01"); // its own target still holds
    expect(a.criticalPath).toEqual(["B", "D"]);
  });

  it("treats an unfinished milestone past its target as landing no earlier than today", () => {
    const a = analyzeSchedule(network(), "2027-01-20");
    expect(node(a, "A").forecastDate).toBe("2027-01-20"); // 19 days late and counting
    expect(node(a, "B").forecastDate).toBe("2027-03-20");
    expect(a.finishSlipDays).toBe(19);
  });

  it("handles milestones with no dependencies and an empty project", () => {
    const flat = analyzeSchedule([ms("X", "2027-01-01"), ms("Y", "2027-02-01", { targetDate: "2027-02-10" })], TODAY);
    expect(flat).toMatchObject({ hasDependencies: false, criticalPath: [], baselineFinish: "2027-02-01", forecastFinish: "2027-02-10", finishSlipDays: 9 });
    expect(flat.nodes.every((n) => !n.critical)).toBe(true); // "critical" means nothing without a network
    expect(analyzeSchedule([], TODAY)).toMatchObject({ nodes: [], criticalPath: [], baselineFinish: null, forecastFinish: null, finishSlipDays: 0 });
  });

  it("ignores dependencies on milestones that no longer exist", () => {
    const a = analyzeSchedule([ms("B", "2027-03-01", { dependsOnIds: ["gone"] })], TODAY);
    expect(node(a, "B")).toMatchObject({ durationDays: null, forecastDate: "2027-03-01" });
  });
});

// ---- shared fixture for performance and daily

const project: Project = { id: "p", slug: "p", name: "Program", description: "", color: "#000000", status: "active", createdAt: "2026-01-01T00:00:00.000Z", budget: 1000 };
const ws = (id: string, over: Partial<Workstream> = {}): Workstream => ({
  id,
  projectId: "p",
  name: `WS ${id}`,
  description: "",
  owner: "",
  order: 0,
  percentComplete: 0,
  plannedStart: null,
  plannedFinish: null,
  ...over,
});
const line = (id: string, workstreamId: string, over: Partial<BudgetLine> = {}): BudgetLine => ({ id, workstreamId, name: id, budget: 0, committed: 0, spent: 0, forecast: 0, order: 0, ...over });
const risk = (id: string, over: Partial<Risk> = {}): Risk => ({
  id,
  projectId: "p",
  workstreamId: null,
  kind: "risk",
  title: id,
  description: "",
  mitigation: "",
  owner: "",
  likelihood: 1,
  impact: 1,
  status: "open",
  dueDate: null,
  createdAt: "2026-11-01T00:00:00.000Z",
  updatedAt: "2026-11-01T00:00:00.000Z",
  ...over,
});

describe("earned value", () => {
  it("computes the planned fraction of a window", () => {
    expect(plannedFraction("2026-11-01", "2026-12-01", "2026-10-15")).toBe(0);
    expect(plannedFraction("2026-11-01", "2026-12-01", "2026-11-16")).toBe(0.5);
    expect(plannedFraction("2026-11-01", "2026-12-01", "2027-01-01")).toBe(1);
    expect(plannedFraction("2026-11-01", "2026-11-01", "2026-11-01")).toBe(1);
  });

  it("derives EV, PV, variances and indices per workstream and in total", () => {
    const snap = buildSnapshot({
      project,
      workstreams: [
        ws("a", { percentComplete: 50, plannedStart: "2026-10-25", plannedFinish: "2026-12-24" }), // 30 of 60 days elapsed
        ws("b", { percentComplete: 10, plannedStart: "2026-11-14", plannedFinish: "2026-12-04" }), // 10 of 20 days elapsed
      ],
      milestones: [],
      budgetLines: [line("l1", "a", { budget: 400, spent: 250 }), line("l2", "a", { budget: 200, spent: 50 }), line("l3", "b", { budget: 400, spent: 20 })],
      risks: [],
      tasks: [],
      today: TODAY,
    });
    const perf = buildPerformance(snap);
    expect(perf.workstreams[0]).toMatchObject({ bac: 600, ac: 300, ev: 300, pv: 300, cv: 0, sv: 0, cpi: 1, spi: 1, eac: 600 });
    expect(perf.workstreams[1]).toMatchObject({ bac: 400, ac: 20, ev: 40, pv: 200, cv: 20, sv: -160, cpi: 2, spi: 0.2, eac: 200 });
    expect(perf.total).toMatchObject({ bac: 1000, ac: 320, ev: 340, pv: 500, cv: 20, sv: -160, percentComplete: 34 });
    expect(perf.total.cpi).toBeCloseTo(1.0625);
    expect(perf.total.spi).toBeCloseTo(0.68);
    expect(perf.missingPlan).toEqual([]);
  });

  it("reports what it cannot compute instead of guessing", () => {
    const snap = buildSnapshot({
      project,
      workstreams: [ws("a", { percentComplete: 25 }), ws("b", { plannedStart: "2026-11-01", plannedFinish: "2026-12-01" })],
      milestones: [],
      budgetLines: [line("l1", "a", { budget: 400 }), line("l2", "b", { budget: 100 })],
      risks: [],
      tasks: [],
      today: TODAY,
    });
    const perf = buildPerformance(snap);
    expect(perf.workstreams[0]).toMatchObject({ ev: 100, ac: 0, pv: null, sv: null, spi: null, cpi: null, eac: null });
    expect(perf.missingPlan).toEqual(["WS a"]);
    expect(perf.total).toMatchObject({ pv: null, spi: null }); // no program-level PV unless every budgeted workstream has a plan
    expect(formatIndex(null)).toBe("n/a");
    expect(formatIndex(0.9666)).toBe("0.97");
  });

  it("counts milestones planned by now against those done", () => {
    const snap = buildSnapshot({
      project,
      workstreams: [],
      milestones: [
        ms("done on time", "2026-11-01", { completedDate: "2026-11-01" }),
        ms("should be done", "2026-11-10"),
        ms("slipped 10", "2027-01-01", { targetDate: "2027-01-11" }),
        ms("slipped 20", "2027-02-01", { targetDate: "2027-02-21" }),
        ms("done early", "2027-03-01", { completedDate: "2026-11-20" }),
      ],
      budgetLines: [],
      risks: [],
      tasks: [],
      today: TODAY,
    });
    expect(buildPerformance(snap).milestones).toEqual({ plannedByNow: 2, plannedDone: 1, done: 2, total: 5, averageSlipDays: 15 });
  });
});

describe("daily loop", () => {
  const members: TeamMember[] = [
    { id: "t1", projectId: "p", workstreamId: "a", name: "Dana Reyes", role: "Engineering lead", email: "dana@example.com" },
    { id: "t2", projectId: "p", workstreamId: null, name: "Sam Okafor", role: "Controls", email: "" },
  ];
  const fixture = () => {
    const milestones = [
      ms("Permits", "2026-11-20", { workstreamId: "a" }), // late
      ms("Design freeze", "2026-12-01", { workstreamId: "a", dependsOnIds: ["Permits"] }), // due soon, critical
      ms("Far future", "2028-01-01", { workstreamId: "a", dependsOnIds: ["Design freeze"] }),
      ms("Kickoff", "2026-10-01", { workstreamId: "a", completedDate: "2026-10-01" }),
    ];
    const snapshot = buildSnapshot({
      project,
      workstreams: [ws("a", { percentComplete: 40, plannedStart: "2026-10-01", plannedFinish: "2027-10-01" }), ws("b")],
      milestones,
      budgetLines: [line("Engineering", "a", { budget: 500, committed: 300, spent: 200, forecast: 560 }), line("Untouched", "b", { budget: 100, forecast: 100 })],
      risks: [
        risk("Supplier delay", { workstreamId: "a", likelihood: 3, impact: 3, owner: "dana reyes", dueDate: "2026-11-10" }),
        risk("Minor thing", { workstreamId: "a" }),
        risk("Due soon", { owner: "Sam Okafor", dueDate: "2026-11-27" }),
        risk("Closed", { status: "closed", likelihood: 3, impact: 3 }),
      ],
      tasks: [],
      today: TODAY,
    });
    return { snapshot, analysis: analyzeSchedule(milestones, TODAY) };
  };

  it("asks only about what needs an update today", () => {
    const { snapshot, analysis } = fixture();
    const checkin = buildDailyCheckin(snapshot, analysis, TODAY);
    expect(checkin.milestones.map((q) => [q.milestone.name, q.reasons])).toEqual([
      ["Permits", ["4 days past its target", "on the critical path"]],
      ["Design freeze", ["due in 7 days", "on the critical path"]],
    ]);
    expect(checkin.workstreams.map((w) => w.id)).toEqual(["a", "b"]);
    expect(checkin.budgetLines.map((q) => q.line.name)).toEqual(["Engineering"]);
    expect(checkin.risks.map((q) => [q.risk.title, q.reasons])).toEqual([
      ["Supplier delay", ["action was due Nov 10, 2026", "high severity"]],
      ["Due soon", ["action due Nov 27, 2026"]],
    ]);
    expect(checkin.count).toBe(2 + 2 + 1 + 2);
  });

  it("selects activity by local calendar day", () => {
    const at = (iso: string): Activity => ({ id: iso, projectId: "p", kind: "change", summary: iso, at: iso });
    const today = new Date(2026, 10, 24, 15, 0).toISOString();
    const yesterday = new Date(2026, 10, 23, 23, 59).toISOString();
    expect(activityOn([at(yesterday), at(today)], TODAY).map((a) => a.at)).toEqual([today]);
  });

  it("writes a summary with today's changes, schedule, cost and risks", () => {
    const { snapshot, analysis } = fixture();
    const activities: Activity[] = [
      { id: "1", projectId: "p", kind: "change", summary: "Milestone Permits: target moved", at: "x" },
      { id: "2", projectId: "p", kind: "note", summary: "Sponsor wants a\nrecovery plan", at: "x" },
    ];
    const text = buildDailySummary({ snapshot, analysis, performance: buildPerformance(snapshot), activities, today: TODAY });
    expect(text).toContain("# Program daily summary, Nov 24, 2026");
    expect(text).toContain("**Overall: Red.**");
    expect(text).toContain("## What changed today\n\n- Milestone Permits: target moved");
    expect(text).toContain("## Notes\n\n- Sponsor wants a recovery plan");
    expect(text).toContain("1 of 4 milestones done; 1 late, 0 slipped, 0 with a dependency conflict.");
    expect(text).toContain("Projected finish Jan 5, 2028 against a baseline of Jan 1, 2028 (4 days later).");
    expect(text).toContain("Of 2 milestones the baseline had finished by now, 1 are done.");
    expect(text).toContain("**Critical path:** Permits (Nov 24, 2026) → Design freeze (Dec 5, 2026) → Far future (Jan 5, 2028)");
    expect(text).toContain("- Permits (WS a), target was Nov 20, 2026");
    expect(text).toContain("Forecast $660 against a budget of $1K: $340 under. Spent $200, committed $300.");
    expect(text).toContain("Earned value $200 (33% complete) against $200 spent: CPI 1.00");
    expect(text).toContain("- Engineering (WS a): $60 over");
    expect(text).toContain("3 open: 1 high severity, 1 past the due date.");
    expect(text).toContain("- Supplier delay (risk, high severity, dana reyes, action was due Nov 10, 2026)");
    expect(text).not.toContain("Closed");
  });

  it("says so when nothing happened and nothing is tracked", () => {
    const snapshot = buildSnapshot({ project: { ...project, budget: 0 }, workstreams: [], milestones: [], budgetLines: [], risks: [], tasks: [], today: TODAY });
    const text = buildDailySummary({ snapshot, analysis: analyzeSchedule([], TODAY), performance: buildPerformance(snapshot), activities: [], today: TODAY });
    expect(text).toContain("**Overall: Green.** Nothing late, over forecast or high severity.");
    expect(text).toContain("No changes were recorded today.");
    expect(text).toContain("No milestones are being tracked yet.");
    expect(text).toContain("No budget has been entered yet.");
    expect(text).toContain("Nothing is open in the register.");
  });

  it("drafts one request per member covering their workstream and the risks they own", () => {
    const { snapshot, analysis } = fixture();
    const drafts = buildTeamMessages({ snapshot, analysis, members, summary: "# Title\n\n**Overall: Red.**\n\n## Schedule\n\n- one", today: TODAY });
    expect(drafts.map((d) => [d.recipient, d.kind])).toEqual([
      ["Dana Reyes", "update_request"],
      ["Sam Okafor", "update_request"],
      ["Whole team", "summary"],
    ]);

    const dana = drafts[0];
    expect(dana).toMatchObject({ memberId: "t1", email: "dana@example.com", subject: "Program: daily update for Nov 24, 2026" });
    expect(dana.body).toContain("Hi Dana,");
    expect(dana.body).toContain("For today's Program update on WS a, please reply with where these stand:");
    expect(dana.body).toContain("- Permits: target Nov 20, 2026 (4 days past its target; on the critical path). Is that date still right, or is it done?");
    expect(dana.body).toContain("- WS a is recorded as 40% complete. What is it now?");
    expect(dana.body).toContain("- Engineering: spent $200, committed $300, forecast $560, $60 over budget. Any change?");
    expect(dana.body).toContain("- Supplier delay (yours, high severity, action was due Nov 10, 2026). What is the status?");
    expect(dana.body).not.toContain("Minor thing");
    expect(dana.body).not.toContain("Far future");

    const sam = drafts[1];
    expect(sam.body).toContain("Hi Sam,");
    expect(sam.body).toContain("- Due soon (yours, low severity, action due Nov 27, 2026). What is the status?");
    expect(sam.body).not.toContain("Milestones");
    expect(sam.body).not.toContain("Progress");

    expect(drafts[2]).toMatchObject({ email: "dana@example.com", subject: "Program daily summary, Nov 24, 2026" });
    expect(drafts[2].body).toBe("Team,\n\nHere is today's summary.\n\nOverall: Red.\n\nSchedule\n\n- one");
  });

  it("drafts nothing without team members, and no summary message unless one is supplied", () => {
    const { snapshot, analysis } = fixture();
    expect(buildTeamMessages({ snapshot, analysis, members: [], summary: "x", today: TODAY })).toEqual([]);
    expect(buildTeamMessages({ snapshot, analysis, members, today: TODAY }).map((d) => d.kind)).toEqual(["update_request", "update_request"]);
    expect(markdownToPlain("# T\n\n## A\n\n**b** c\n\n\n\n- d")).toBe("A\n\nb c\n\n- d");
  });
});
