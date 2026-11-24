import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { listBudgetLines } from "../budget";
import { parseCsv, toCsv } from "../csv";
import { prisma } from "../db";
import { exportCsv, importCsv } from "../import";
import { autoMap, parseDate, parseLevel, parseRiskKind, parseRiskStatus, readImport } from "../interchange";
import { createMilestone, listMilestones } from "../milestones";
import { createProject } from "../projects";
import { listRisks } from "../risks";
import { listMembers } from "../team";
import { listWorkstreams } from "../workstreams";

describe("csv", () => {
  it("parses quotes, embedded delimiters, quotes and line breaks", () => {
    expect(parseCsv('a,b,c\r\n1,"two, 2","say ""hi"""\n"line\nbreak",,x\n')).toEqual([
      ["a", "b", "c"],
      ["1", "two, 2", 'say "hi"'],
      ["line\nbreak", "", "x"],
    ]);
  });

  it("drops blank lines and a byte-order mark, and detects semicolons and tabs", () => {
    expect(parseCsv("﻿Name;Date\n\nA;1\n;\n")).toEqual([["Name", "Date"], ["A", "1"]]);
    expect(parseCsv("Name\tDate\nA\t1")).toEqual([["Name", "Date"], ["A", "1"]]);
    expect(parseCsv("")).toEqual([]);
  });

  it("round-trips through toCsv and neutralises formula cells", () => {
    const rows = [["Name", "Note"], ['He said "no"', "a, b"], ["multi\nline", ""], ["=SUM(A1)", "-5"]];
    const text = toCsv(rows);
    expect(text).toContain("'=SUM(A1)");
    expect(parseCsv(text).slice(0, 3)).toEqual(rows.slice(0, 3));
    expect(toCsv([["n", -5, null]])).toBe("n,-5,\r\n");
  });
});

describe("reading other tools' exports", () => {
  it("reads the date forms other tools produce, month first for slashes", () => {
    expect(parseDate("2027-03-04")).toBe("2027-03-04");
    expect(parseDate("2027-03-04T08:00:00Z")).toBe("2027-03-04");
    expect(parseDate("3/4/2027")).toBe("2027-03-04");
    expect(parseDate("03/04/27")).toBe("2027-03-04");
    expect(parseDate("3/4/2027 5:00 PM")).toBe("2027-03-04");
    expect(parseDate("4-Mar-2027")).toBe("2027-03-04");
    expect(parseDate("04 March 2027")).toBe("2027-03-04");
    expect(parseDate("Mar 4, 2027")).toBe("2027-03-04");
    expect(parseDate("March 4 2027")).toBe("2027-03-04");
    for (const bad of ["", "soon", "2027-02-30", "13/40/2027", "Q3 2027", "4-Foo-2027"]) expect(parseDate(bad)).toBeNull();
  });

  it("reads levels, statuses and kinds in several vocabularies", () => {
    expect([parseLevel("Low"), parseLevel("2"), parseLevel("HIGH"), parseLevel("Critical"), parseLevel("?")]).toEqual([1, 2, 3, 3, null]);
    expect([parseRiskStatus("New"), parseRiskStatus("In Progress"), parseRiskStatus("Resolved"), parseRiskStatus("x")]).toEqual(["open", "mitigating", "closed", null]);
    expect([parseRiskKind("Risk"), parseRiskKind("Issue"), parseRiskKind("Bug"), parseRiskKind("Epic")]).toEqual(["risk", "issue", "issue", null]);
  });

  it("matches columns by their name in Azure DevOps, MS Project and this tracker", () => {
    expect(autoMap("milestones", ["ID", "Work Item Type", "Title", "State", "Area Path", "Target Date"])).toMatchObject({ name: 2, status: 3, workstream: 4, targetDate: 5, baselineDate: null });
    expect(autoMap("milestones", ["Task Name", "Finish", "Baseline Finish", "Actual Finish", "Predecessors", "% Complete"])).toMatchObject({ name: 0, targetDate: 1, baselineDate: 2, completedDate: 3, dependsOn: 4, status: 5 });
    expect(autoMap("budget", ["Workstream", "Name", "Budget", "Committed", "Spent", "Forecast"])).toEqual({ workstream: 0, name: 1, budget: 2, committed: 3, spent: 4, forecast: 5 });
    expect(autoMap("risks", ["Title", "Assigned To", "State", "Probability", "Severity"])).toMatchObject({ title: 0, owner: 1, status: 2, likelihood: 3, impact: 4 });
    // "Name" must map to the name field even though "title"-like aliases exist elsewhere.
    expect(autoMap("team", ["Email", "Name", "Title"])).toEqual({ email: 0, name: 1, role: 2, workstream: null });
  });

  it("reports unreadable rows by line and leaves them out", () => {
    const read = readImport("milestones", "Title,Target Date,State\nGood one,3/1/2027,Active\n,3/1/2027,\nBad date,someday,\nNo date,,Done\n");
    expect(read.items).toMatchObject([{ name: "Good one", targetDate: "2027-03-01", done: false, line: 2 }]);
    expect(read.issues).toEqual([
      { line: 3, message: "Name is blank" },
      { line: 4, message: 'Target date "someday" isn\'t a date I can read' },
      { line: 5, message: "Target date is blank" },
    ]);
    expect(read.rowCount).toBe(4);
  });

  it("stops with one clear message when a required column is missing", () => {
    const read = readImport("budget", "Thing,Amount\nX,5\n");
    expect(read.items).toEqual([]);
    expect(read.issues).toEqual([{ line: 1, message: "No column found for: Workstream, Name. Choose the matching columns above." }]);
    expect(readImport("budget", "Thing,Zone,Amount\nX,Civil,5M\n", { name: 0, workstream: 1, budget: 2 }).items).toMatchObject([{ name: "X", workstream: "Civil", budget: 5_000_000 }]);
  });
});

describe("importing into a project", () => {
  beforeEach(async () => {
    await prisma.project.deleteMany();
  });
  afterAll(() => prisma.$disconnect());
  const newProject = () => createProject({ name: "Program", color: "#2F6F4E" });

  it("previews without writing, then imports milestones with workstreams, completion and dependencies", async () => {
    const p = await newProject();
    await createMilestone({ projectId: p.id, name: "Permits granted", targetDate: "2027-03-01" });
    const csv = [
      "Title,Target Date,Baseline Finish,State,Area Path,Predecessors",
      "Design frozen,1/15/2027,1/15/2027,Done,Engineering,",
      "permits granted,4/1/2027,,Active,Engineering,Design frozen",
      "First steel,9/1/2027,8/1/2027,New,Construction,Permits granted; Unknown thing",
    ].join("\n");

    const preview = await importCsv(p, "milestones", csv, { dryRun: true });
    expect(preview).toMatchObject({ dryRun: true, rowCount: 3, created: 2, updated: 1, workstreamsCreated: ["Engineering", "Construction"], issues: [] });
    expect(preview.warnings).toHaveLength(1);
    expect(await listMilestones(p.id)).toHaveLength(1);
    expect(await listWorkstreams(p.id)).toEqual([]);

    const done = await importCsv(p, "milestones", csv, { dryRun: false });
    expect(done).toMatchObject({ dryRun: false, created: 2, updated: 1 });
    expect(done.warnings[0]).toContain('"Unknown thing"');
    const all = await listMilestones(p.id);
    const by = (name: string) => all.find((m) => m.name === name)!;
    expect(all).toHaveLength(3);
    expect(by("Design frozen").completedDate).not.toBeNull();
    // The existing milestone was matched ignoring case; its target moved and its baseline was kept.
    expect(by("Permits granted")).toMatchObject({ targetDate: "2027-04-01", baselineDate: "2027-03-01", dependsOnIds: [by("Design frozen").id] });
    expect(by("First steel")).toMatchObject({ targetDate: "2027-09-01", baselineDate: "2027-08-01", dependsOnIds: [by("Permits granted").id] });
    expect((await listWorkstreams(p.id)).map((w) => w.name)).toEqual(["Engineering", "Construction"]);

    // Importing the same file again changes nothing and adds nothing.
    const again = await importCsv(p, "milestones", csv, { dryRun: false });
    expect(again).toMatchObject({ created: 0, updated: 3 });
    expect(await listMilestones(p.id)).toHaveLength(3);
  });

  it("imports budget lines, risks and team members, updating on a second pass", async () => {
    const p = await newProject();
    await importCsv(p, "budget", "WBS,Cost Item,BAC,Actual Cost,EAC\nEquipment,Furnace,$2.4B,300M,2.55B\nEquipment,Cranes,\"150,000,000.00\",,\n", { dryRun: false });
    expect(await listBudgetLines(p.id)).toMatchObject([
      { name: "Furnace", budget: 2_400_000_000, spent: 300_000_000, forecast: 2_550_000_000 },
      { name: "Cranes", budget: 150_000_000, forecast: 150_000_000 },
    ]);
    const second = await importCsv(p, "budget", "Workstream,Name,Spent\nequipment,furnace,450M\n", { dryRun: false });
    expect(second).toMatchObject({ created: 0, updated: 1, workstreamsCreated: [] });
    expect((await listBudgetLines(p.id))[0]).toMatchObject({ spent: 450_000_000, budget: 2_400_000_000 });

    const risks = await importCsv(p, "risks", "Title,Work Item Type,Probability,Severity,State,Assigned To,Due Date,Mitigation\nSupplier delay,Risk,High,High,Active,Dana,12/1/2026,Second source\nCrane outage,Issue,,Medium,Wat,,,\n", { dryRun: false });
    expect(risks).toMatchObject({ created: 1, issues: [{ line: 3, message: 'Status "Wat" isn\'t recognised (expected Open, Mitigating or Closed)' }] });
    expect(await listRisks(p.id)).toMatchObject([{ title: "Supplier delay", kind: "risk", likelihood: 3, impact: 3, status: "open", owner: "Dana", dueDate: "2026-12-01", mitigation: "Second source" }]);

    await importCsv(p, "team", "Name,Email,Title,Team\nDana Reyes,dana@example.com,Engineering lead,Equipment\nSam,,Controls,\nBad,not-an-email,,\n", { dryRun: false });
    const members = await listMembers(p.id);
    expect(members.map((m) => [m.name, m.email, m.role])).toEqual([
      ["Dana Reyes", "dana@example.com", "Engineering lead"],
      ["Sam", "", "Controls"],
    ]);
    await importCsv(p, "team", "Name,Email,Role\nDana R. Reyes,DANA@example.com,Director\n", { dryRun: false });
    expect((await listMembers(p.id)).map((m) => [m.name, m.role])).toEqual([["Dana R. Reyes", "Director"], ["Sam", "Controls"]]);
  });

  it("exports files the import reads back unchanged", async () => {
    const p = await newProject();
    await importCsv(p, "milestones", "Name,Target date,Workstream,Depends on\nA,2027-01-01,Eng,\nB,2027-02-01,Eng,A\n", { dryRun: false });
    await importCsv(p, "budget", "Workstream,Name,Budget,Spent\nEng,Design,400M,10M\n", { dryRun: false });
    await importCsv(p, "risks", "Title,Type,Likelihood,Impact,Status,Workstream\n\"Late, again\",Issue,High,Medium,Mitigating,Eng\n", { dryRun: false });
    await importCsv(p, "team", "Name,Email,Workstream\nDana,dana@example.com,Eng\n", { dryRun: false });

    const milestonesCsv = await exportCsv(p, "milestones");
    expect(parseCsv(milestonesCsv)).toEqual([
      ["Name", "Target date", "Baseline date", "Completed date", "Status", "Workstream", "Depends on"],
      ["A", "2027-01-01", "2027-01-01", "", "Open", "Eng", ""],
      ["B", "2027-02-01", "2027-02-01", "", "Open", "Eng", "A"],
    ]);
    expect(parseCsv(await exportCsv(p, "budget"))[1]).toEqual(["Eng", "Design", "400000000", "0", "10000000", "400000000"]);
    expect(parseCsv(await exportCsv(p, "risks"))[1].slice(0, 5)).toEqual(["Late, again", "Issue", "High", "Medium", "Mitigating"]);

    for (const entity of ["milestones", "budget", "risks", "team"] as const) {
      const back = await importCsv(p, entity, await exportCsv(p, entity), { dryRun: true });
      expect(back).toMatchObject({ created: 0, issues: [], warnings: [] });
      expect(back.updated).toBeGreaterThan(0);
    }
  });
});
