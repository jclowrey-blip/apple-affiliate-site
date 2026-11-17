// Seeds two sample projects with 15 tasks. Dates are relative to the day the
// seed runs so the dashboard always has overdue and due-this-week tasks.
// Run with: npm run db:seed (wipes existing PM data first).
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

function day(offset) {
  const now = new Date();
  return new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate() + offset));
}

const projects = [
  {
    slug: "orchard-storefront",
    name: "Orchard storefront",
    description: "Launch work for the Apple affiliate site.",
    color: "#2F6F4E",
    status: "active",
    milestones: [
      { key: "apply", name: "Associates application", targetDate: day(10) },
      { key: "launch", name: "Public launch", targetDate: day(35) },
    ],
    tasks: [
      { title: "Write three buying guides", status: "in_progress", priority: "high", due: 3, labels: ["content"], milestone: "apply",
        description: "Amazon wants **original content** before approving.\n\n- iPhone lineup compared\n- Which Mac for students\n- AirPods buyer's guide",
        subtasks: [["iPhone lineup compared", true], ["Which Mac for students", false], ["AirPods buyer's guide", false]] },
      { title: "Have a lawyer review the disclosure page", status: "todo", priority: "high", due: -2, labels: ["legal"], milestone: "apply" },
      { title: "Replace placeholder tracking tag", status: "backlog", priority: "medium", due: 12, labels: ["config"], milestone: "apply",
        description: "Swap `YOUR-TAG-20` in `lib/products.ts` once approved." },
      { title: "Submit Amazon Associates application", status: "todo", priority: "high", due: 10, labels: ["legal"], milestone: "apply" },
      { title: "Wire up PA-API product data", status: "backlog", priority: "medium", due: 24, labels: ["api"], milestone: "launch",
        subtasks: [["Request API keys", false], ["Implement signed requests", false], ["Cache responses for 1 hour", false]] },
      { title: "Add real product images", status: "backlog", priority: "low", due: 28, labels: ["content", "design"], milestone: "launch" },
      { title: "Set up analytics", status: "todo", priority: "low", due: 5, labels: ["config"], milestone: "launch" },
      { title: "Category icons", status: "done", priority: "medium", due: -6, labels: ["design"] },
      { title: "Comparison table page", status: "done", priority: "medium", due: -12, labels: ["content"] },
    ],
  },
  {
    slug: "home-lab",
    name: "Home lab",
    description: "Side project: tidy up the home server and backups.",
    color: "#B3541E",
    status: "active",
    milestones: [{ key: "backups", name: "Backups verified", targetDate: day(18) }],
    tasks: [
      { title: "Automate nightly backups", status: "in_progress", priority: "high", due: 1, labels: ["infra"], milestone: "backups",
        subtasks: [["Pick a backup tool", true], ["Write the cron job", true], ["Alert on failure", false]] },
      { title: "Test a full restore", status: "todo", priority: "high", due: 16, labels: ["infra"], milestone: "backups",
        description: "A backup that has never been restored is a *hope*, not a backup." },
      { title: "Renew domain", status: "todo", priority: "medium", due: -1, labels: ["admin"] },
      { title: "Move DNS to new provider", status: "backlog", priority: "low", due: null, labels: ["infra"] },
      { title: "Document the network layout", status: "backlog", priority: "low", due: 30, labels: ["docs"] },
      { title: "Replace failing disk", status: "done", priority: "high", due: -9, labels: ["hardware"] },
    ],
  },
];

async function main() {
  await prisma.subtask.deleteMany();
  await prisma.task.deleteMany();
  await prisma.label.deleteMany();
  await prisma.milestone.deleteMany();
  await prisma.project.deleteMany();

  let taskCount = 0;
  for (const p of projects) {
    const project = await prisma.project.create({
      data: { slug: p.slug, name: p.name, description: p.description, color: p.color, status: p.status },
    });
    const milestoneIds = {};
    for (const m of p.milestones) {
      const created = await prisma.milestone.create({
        data: { name: m.name, targetDate: m.targetDate, projectId: project.id },
      });
      milestoneIds[m.key] = created.id;
    }
    const nextOrder = {};
    for (const t of p.tasks) {
      const order = nextOrder[t.status] ?? 0;
      nextOrder[t.status] = order + 1;
      await prisma.task.create({
        data: {
          title: t.title,
          description: t.description ?? "",
          status: t.status,
          priority: t.priority,
          dueDate: t.due === null ? null : day(t.due),
          order,
          projectId: project.id,
          milestoneId: t.milestone ? milestoneIds[t.milestone] : null,
          labels: {
            connectOrCreate: t.labels.map((name) => ({ where: { name }, create: { name } })),
          },
          subtasks: {
            create: (t.subtasks ?? []).map(([title, done], i) => ({ title, done, order: i })),
          },
        },
      });
      taskCount++;
    }
  }
  console.log(`Seeded ${projects.length} projects and ${taskCount} tasks.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
