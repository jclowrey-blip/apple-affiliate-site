import Link from "next/link";
import { ProjectStatusBadge } from "@/components/pm/Badges";
import EmptyState from "@/components/pm/EmptyState";
import NewProjectForm from "@/components/pm/NewProjectForm";
import ProgressBar from "@/components/pm/ProgressBar";
import TaskRow from "@/components/pm/TaskRow";
import { endOfWeek, formatDate, todayISO } from "@/lib/pm/dates";
import { listProjectSummaries } from "@/lib/pm/projects";
import { listOverdueTasks, listTasksDueBetween } from "@/lib/pm/tasks";
import type { TaskWithProject } from "@/lib/pm/types";

function TaskSection({
  title,
  hint,
  tasks,
  today,
  empty,
  tone = "default",
}: {
  title: string;
  hint: string;
  tasks: TaskWithProject[];
  today: string;
  empty: string;
  tone?: "default" | "warn";
}) {
  return (
    <section aria-labelledby={`section-${title}`} className="min-w-0">
      <div className="mb-2 flex items-baseline justify-between gap-3">
        <h2 id={`section-${title}`} className="font-display text-base text-ink">
          {title}{" "}
          <span className={`font-mono text-sm ${tone === "warn" && tasks.length > 0 ? "text-warn" : "text-graphite"}`}>
            {tasks.length}
          </span>
        </h2>
        <span className="text-xs text-graphite">{hint}</span>
      </div>
      {tasks.length === 0 ? (
        <EmptyState title={empty} compact />
      ) : (
        <ul className="divide-y divide-line overflow-hidden rounded-lg border border-line bg-white">
          {tasks.map((task) => (
            <TaskRow key={task.id} task={task} today={today} />
          ))}
        </ul>
      )}
    </section>
  );
}

export default async function DashboardPage() {
  const today = todayISO();
  const weekEnd = endOfWeek(today);
  const [projects, overdue, dueThisWeek] = await Promise.all([
    listProjectSummaries(),
    listOverdueTasks(today),
    listTasksDueBetween(today, weekEnd),
  ]);

  if (projects.length === 0) {
    return (
      <div className="mx-auto max-w-md py-10">
        <EmptyState title="No projects yet" action={<NewProjectForm />}>
          Create a project to start tracking tasks, milestones and due dates.
        </EmptyState>
      </div>
    );
  }

  return (
    <div className="space-y-10">
      <section aria-labelledby="projects-heading">
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <h1 id="projects-heading" className="font-display text-2xl text-ink">
            Projects
          </h1>
          <NewProjectForm />
        </div>
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {projects.map((project) => (
            <li key={project.id}>
              <Link
                href={`/pm/${project.slug}/board`}
                className="flex h-full flex-col gap-3 rounded-lg border border-line bg-white p-4 hover:border-graphite transition-colors"
              >
                <div className="flex items-start gap-2.5">
                  <span
                    className="mt-1.5 h-3 w-3 shrink-0 rounded-full"
                    style={{ backgroundColor: project.color }}
                    aria-hidden="true"
                  />
                  <h2 className="min-w-0 flex-1 break-words font-display text-base text-ink">{project.name}</h2>
                  <ProjectStatusBadge status={project.status} />
                </div>
                <p className="line-clamp-2 flex-1 text-sm text-graphite">{project.description || "No description."}</p>
                <ProgressBar done={project.doneTasks} total={project.totalTasks} color={project.color} />
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <div className="grid gap-8 lg:grid-cols-2">
        <TaskSection
          title="Overdue"
          hint={`before ${formatDate(today)}`}
          tasks={overdue}
          today={today}
          empty="Nothing overdue"
          tone="warn"
        />
        <TaskSection
          title="Due this week"
          hint={`${formatDate(today)} – ${formatDate(weekEnd)}`}
          tasks={dueThisWeek}
          today={today}
          empty="Nothing due this week"
        />
      </div>
    </div>
  );
}
