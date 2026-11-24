// Seeds ONE sample capital program so the Program, Budget, Risks and Reports
// views have something to show. Every workstream, date, amount and risk here
// is a made-up placeholder, not real project data. Dates are relative to the
// day the seed runs. Re-running replaces only this sample project.
// Run with: npm run db:seed:program
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const SLUG = "us-steel-capital-program";

function day(offset) {
  const now = new Date();
  return new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate() + offset));
}
const M = 1_000_000;

// key, name, owner role, [budget lines: name, budget, committed, spent, forecast] in $M
const workstreams = [
  { key: "pmo", name: "Program management and controls", owner: "Program director (TBD)", lines: [
    ["Program office and controls", 180, 60, 22, 180],
    ["Contingency reserve", 420, 0, 0, 420],
  ] },
  { key: "eng", name: "Engineering and permitting", owner: "Engineering lead (TBD)", lines: [
    ["Front-end and detailed engineering", 520, 310, 140, 545],
    ["Permits and environmental studies", 80, 35, 18, 80],
  ] },
  { key: "proc", name: "Procurement and long-lead equipment", owner: "Procurement lead (TBD)", lines: [
    ["Long-lead process equipment", 2300, 900, 210, 2420],
    ["Electrical and automation", 650, 120, 15, 650],
  ] },
  { key: "con", name: "Construction", owner: "Construction lead (TBD)", lines: [
    ["Site preparation and civil works", 900, 260, 75, 900],
    ["Structural, mechanical and piping", 1500, 0, 0, 1500],
  ] },
  { key: "com", name: "Commissioning and ramp-up", owner: "Operations lead (TBD)", lines: [
    ["Commissioning and start-up", 300, 0, 0, 300],
    ["Training and operational readiness", 150, 0, 0, 150],
  ] },
];

// key, workstream, name, baseline offset (days), target offset, completed offset?, depends on
const milestones = [
  ["charter", "pmo", "Program charter and baseline approved", -40, -40, -38, []],
  ["feed", "eng", "Front-end engineering complete", -10, -10, null, []],
  ["permits", "eng", "Major permits granted", 120, 165, null, ["feed"]],
  ["detail", "eng", "Detailed engineering 90% complete", 270, 270, null, ["feed"]],
  ["orders", "proc", "Long-lead equipment orders placed", 60, 60, null, ["feed"]],
  ["delivery", "proc", "Long-lead equipment delivered to site", 560, 610, null, ["orders"]],
  ["mobilize", "con", "Construction mobilized", 150, 150, null, ["permits"]],
  ["civil", "con", "Civil works complete", 420, 420, null, ["mobilize"]],
  ["mech", "con", "Mechanical completion", 820, 820, null, ["civil", "delivery"]],
  ["firstrun", "com", "First production run", 900, 900, null, ["mech"]],
  ["ramp", "com", "Ramp-up to full rate complete", 1090, 1090, null, ["firstrun"]],
];

const risks = [
  { kind: "risk", title: "Long-lead equipment delivery slips", ws: "proc", likelihood: 3, impact: 3, status: "mitigating", due: 20, owner: "Procurement lead (TBD)",
    description: "Supplier lead times could push delivery past the date construction needs it.", mitigation: "Expedite fabrication slots; identify a second source for critical items." },
  { kind: "risk", title: "Permit review takes longer than planned", ws: "eng", likelihood: 2, impact: 3, status: "open", due: -5, owner: "Engineering lead (TBD)",
    description: "Agency review cycles are outside the program's control.", mitigation: "Weekly agency check-ins; pre-submit supporting studies." },
  { kind: "issue", title: "Engineering forecast running over budget", ws: "eng", likelihood: 3, impact: 2, status: "open", due: 14, owner: "Program director (TBD)",
    description: "Scope growth in detailed engineering has raised the forecast above the line budget.", mitigation: "Scope freeze review; draw on contingency if approved." },
  { kind: "risk", title: "Skilled labor shortage during peak construction", ws: "con", likelihood: 2, impact: 2, status: "open", due: 90, owner: "Construction lead (TBD)",
    description: "", mitigation: "Early agreements with trades; staggered shift plan." },
  { kind: "risk", title: "Commodity price escalation", ws: "proc", likelihood: 2, impact: 2, status: "open", due: null, owner: "",
    description: "", mitigation: "Fixed-price terms where available; track indices monthly." },
  { kind: "risk", title: "Program baseline not agreed by sponsors", ws: "pmo", likelihood: 1, impact: 3, status: "closed", due: -30, owner: "Program director (TBD)",
    description: "", mitigation: "Closed: baseline approved with the charter." },
];

const tasks = [
  ["Replace this sample data with the real schedule and budget", "todo", "high", 7, null],
  ["Confirm workstream owners", "todo", "high", 10, null],
  ["Issue the monthly status report", "todo", "medium", 5, null],
  ["Close out front-end engineering review comments", "in_progress", "high", -3, "feed"],
  ["Submit remaining permit applications", "in_progress", "high", 12, "permits"],
  ["Finalize long-lead equipment bid evaluation", "todo", "high", 25, "orders"],
  ["Draft construction mobilization plan", "backlog", "medium", 80, "mobilize"],
  ["Set up cost reporting by workstream", "done", "medium", -20, null],
];

async function main() {
  await prisma.project.deleteMany({ where: { slug: SLUG } });
  const project = await prisma.project.create({
    data: {
      slug: SLUG,
      name: "US Steel capital program",
      description: "SAMPLE DATA: placeholder workstreams, dates and amounts for a 3-year, $7B program. Replace with real figures.",
      color: "#2B5F8A",
      status: "active",
      budget: BigInt(7000 * M),
    },
  });

  const wsId = {};
  for (const [order, w] of workstreams.entries()) {
    const created = await prisma.workstream.create({
      data: {
        projectId: project.id,
        name: w.name,
        owner: w.owner,
        order,
        budgetLines: {
          create: w.lines.map(([name, budget, committed, spent, forecast], i) => ({
            name,
            order: i,
            budget: BigInt(budget * M),
            committed: BigInt(committed * M),
            spent: BigInt(spent * M),
            forecast: BigInt(forecast * M),
          })),
        },
      },
    });
    wsId[w.key] = created.id;
  }

  const msId = {};
  for (const [key, ws, name, baseline, target, completed, deps] of milestones) {
    const created = await prisma.milestone.create({
      data: {
        projectId: project.id,
        workstreamId: wsId[ws],
        name,
        baselineDate: day(baseline),
        targetDate: day(target),
        completedDate: completed === null ? null : day(completed),
        dependsOn: { connect: deps.map((d) => ({ id: msId[d] })) },
      },
    });
    msId[key] = created.id;
  }

  for (const r of risks) {
    await prisma.risk.create({
      data: {
        projectId: project.id,
        workstreamId: wsId[r.ws],
        kind: r.kind,
        title: r.title,
        description: r.description,
        mitigation: r.mitigation,
        owner: r.owner,
        likelihood: r.likelihood,
        impact: r.impact,
        status: r.status,
        dueDate: r.due === null ? null : day(r.due),
      },
    });
  }

  const nextOrder = {};
  for (const [title, status, priority, due, ms] of tasks) {
    const order = nextOrder[status] ?? 0;
    nextOrder[status] = order + 1;
    await prisma.task.create({
      data: { projectId: project.id, title, status, priority, dueDate: day(due), order, milestoneId: ms ? msId[ms] : null },
    });
  }

  console.log(`Seeded sample program "${project.name}" at /pm/${SLUG}/program (placeholder data).`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
