// Seeds two sample projects with 15 tasks. WARNING: wipes all existing /pm data first.
// Run with: npm run db:seed
import { PrismaClient } from "@prisma/client";
import { addDays, todayISO } from "../lib/pm/dates";

const prisma = new PrismaClient();
const today = todayISO();
const day = (offset: number) => addDays(today, offset);

type SeedTask = {
  title: string;
  description?: string;
  status: "backlog" | "todo" | "in_progress" | "done";
  priority?: "low" | "medium" | "high";
  due?: number; // days from today
  labels?: string[];
  milestone?: string;
  subtasks?: [string, boolean][];
};

async function seedProject(
  project: { slug: string; name: string; description: string; color: string; status: string },
  milestones: { name: string; target: number }[],
  tasks: SeedTask[],
) {
  const created = await prisma.project.create({ data: project });
  const milestoneIds = new Map<string, string>();
  for (const m of milestones) {
    const row = await prisma.milestone.create({
      data: { projectId: created.id, name: m.name, targetDate: day(m.target) },
    });
    milestoneIds.set(m.name, row.id);
  }
  const positions: Record<string, number> = {};
  for (const t of tasks) {
    const position = positions[t.status] ?? 0;
    positions[t.status] = position + 1;
    await prisma.task.create({
      data: {
        projectId: created.id,
        title: t.title,
        description: t.description ?? "",
        status: t.status,
        priority: t.priority ?? "medium",
        dueDate: t.due === undefined ? null : day(t.due),
        position,
        milestoneId: t.milestone ? milestoneIds.get(t.milestone) : null,
        labels: {
          connectOrCreate: (t.labels ?? []).map((name) => ({
            where: { projectId_name: { projectId: created.id, name } },
            create: { projectId: created.id, name },
          })),
        },
        subtasks: {
          create: (t.subtasks ?? []).map(([title, done], i) => ({ title, done, position: i })),
        },
      },
    });
  }
}

async function main() {
  await prisma.project.deleteMany(); // cascades to tasks, subtasks, milestones, labels

  await seedProject(
    {
      slug: "orchard-storefront",
      name: "Orchard storefront",
      description: "Launch work for the Apple affiliate site: content, compliance, live data.",
      color: "#2F6F4E",
      status: "active",
    },
    [
      { name: "Associates application", target: 10 },
      { name: "Live product data", target: 45 },
    ],
    [
      {
        title: "Apply to Amazon Associates",
        description:
          "Needs a **live site with real content** before review.\n\n- Fill in tax details\n- List the site URL\n- Describe traffic sources",
        status: "in_progress",
        priority: "high",
        due: 3,
        labels: ["compliance"],
        milestone: "Associates application",
        subtasks: [
          ["Create Associates account", true],
          ["Submit site for review", false],
        ],
      },
      {
        title: "Have a lawyer review DISCLOSURE.md",
        status: "todo",
        priority: "high",
        due: -2,
        labels: ["compliance", "legal"],
        milestone: "Associates application",
      },
      {
        title: "Write three buying guides",
        description: "Start with *iPhone vs iPhone Pro*, then MacBook Air sizing, then AirPods lineup.",
        status: "in_progress",
        priority: "medium",
        due: 6,
        labels: ["content"],
        milestone: "Associates application",
        subtasks: [
          ["iPhone vs iPhone Pro", true],
          ["MacBook Air 13 vs 15", false],
          ["Which AirPods?", false],
        ],
      },
      {
        title: "Replace YOUR-TAG-20 with real tracking ID",
        status: "backlog",
        priority: "high",
        labels: ["compliance"],
        milestone: "Associates application",
      },
      {
        title: "Shoot original product photography",
        description: "Do not use Apple marketing images. See `DISCLOSURE.md` §3.",
        status: "todo",
        priority: "medium",
        due: 14,
        labels: ["content", "design"],
      },
      {
        title: "Implement getItemsByAsin against PA-API",
        status: "backlog",
        priority: "medium",
        due: 30,
        labels: ["engineering"],
        milestone: "Live product data",
      },
      {
        title: "Scheduled price refresh into a cache",
        status: "backlog",
        priority: "low",
        due: 40,
        labels: ["engineering"],
        milestone: "Live product data",
      },
      {
        title: "Add privacy policy page",
        status: "done",
        priority: "medium",
        due: -10,
        labels: ["compliance"],
      },
      {
        title: "Category icons for product cards",
        status: "done",
        priority: "low",
        due: -5,
        labels: ["design"],
      },
    ],
  );

  await seedProject(
    {
      slug: "newsletter",
      name: "Weekly newsletter",
      description: "A small side project: a weekly email of Apple deals worth knowing about.",
      color: "#2D5F8A",
      status: "active",
    },
    [{ name: "First issue", target: 21 }],
    [
      {
        title: "Pick an email provider",
        description: "Compare pricing at 1k and 10k subscribers.",
        status: "done",
        priority: "high",
        due: -7,
        labels: ["research"],
        milestone: "First issue",
      },
      {
        title: "Design the issue template",
        status: "in_progress",
        priority: "medium",
        due: 2,
        labels: ["design"],
        milestone: "First issue",
        subtasks: [
          ["Header and footer", true],
          ["Deal card block", false],
        ],
      },
      {
        title: "Signup form on the storefront",
        status: "todo",
        priority: "medium",
        due: 9,
        labels: ["engineering"],
        milestone: "First issue",
      },
      {
        title: "Write issue #1",
        status: "todo",
        priority: "high",
        due: 20,
        labels: ["content"],
        milestone: "First issue",
      },
      {
        title: "Check affiliate link rules for email",
        description: "Amazon restricts affiliate links in email. Confirm what is allowed before sending.",
        status: "todo",
        priority: "high",
        due: -1,
        labels: ["compliance"],
      },
      {
        title: "Collect ideas for recurring sections",
        status: "backlog",
        priority: "low",
        labels: ["content"],
      },
    ],
  );

  const [projects, tasks] = await Promise.all([prisma.project.count(), prisma.task.count()]);
  console.log(`Seeded ${projects} projects and ${tasks} tasks.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
