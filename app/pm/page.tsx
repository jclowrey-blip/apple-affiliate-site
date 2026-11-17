import Link from "next/link";
import ProjectFormButton from "@/components/pm/ProjectFormButton";
import TaskPanelSlot from "@/components/pm/TaskPanelSlot";
import TaskLink from "@/components/pm/TaskLink";
import { btnPrimary } from "@/components/pm/styles";
import { DueDate, EmptyState, PriorityBadge, ProgressBar, StatusBadge } from "@/components/pm/ui";
import { requireAccess } from "@/lib/pm/access";
import { endOfWeek, todayString } from "@/lib/pm/dates";
import { listProjects } from "@/lib/pm/projects";
import { listOpenTasksDueBy } from "@/lib/pm/tasks";
import { PROJECT_STATUS_LABELS, type DateString, type TaskWithProject } from "@/lib/pm/types";

export const metadata = { title: "Dashboard" };

function TaskRows({ tasks, today }: { tasks: TaskWithProject[]; today: DateString }) {
  return (
    <ul className="divide-y divide-line rounded-lg border border-line bg-white">
      {tasks.map((task) => (
        <li key={task.id}>
          <TaskLink
            taskId={task.id}
            className="flex flex-col gap-1 px-4 py-3 hover:bg-paper sm:flex-row sm:items-center sm:gap-4"
          >
            <span className="min-w-0 flex-1 truncate text-sm text-ink">{task.title}</span>
            <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <span className="flex items-center gap-1.5 text-xs text-graphite">
                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: task.project.color }} aria-hidden />
                {task.project.name}
              </span>
              <StatusBadge status={task.status} />
              <PriorityBadge priority={task.priority} />
              {task.dueDate && <DueDate date={task.dueDate} today={today} />}
            </span>
          </TaskLink>
        </li>
      ))}
    </ul>
  );
}

export default async function DashboardPage({ searchParams }: { searchParams: { task?: string | string[] } }) {
  await requireAccess();
  const today = todayString();
  const weekEnd = endOfWeek(today);
  const [projects, due] = await Promise.all([listProjects(), listOpenTasksDueBy(weekEnd)]);
  const overdue = due.filter((t) => t.dueDate! < today);
  const thisWeek = due.filter((t) => t.dueDate! >= today);

  if (projects.length === 0) {
    return (
      <EmptyState
        title="No projects yet"
        body="Create a project to start tracking tasks, milestones and due dates."
        action={<ProjectFormButton className={btnPrimary}>New project</ProjectFormButton>}
      />
    );
  }

  return (
    <div className="space-y-10">
      <section aria-labelledby="pm-projects-heading">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h1 id="pm-projects-heading" className="font-display text-xl text-ink">
            Projects
          </h1>
          <ProjectFormButton className={btnPrimary}>New project</ProjectFormButton>
        </div>
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {projects.map((p) => (
            <li key={p.id}>
              <Link
                href={`/pm/${p.slug}/board`}
                className="block h-full rounded-lg border border-line bg-white p-4 transition-colors hover:border-graphite"
              >
                <div className="flex items-start justify-between gap-3">
                  <span className="flex min-w-0 items-center gap-2">
                    <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: p.color }} aria-hidden />
                    <span className="truncate font-display text-base text-ink">{p.name}</span>
                  </span>
                  <span className="shrink-0 rounded-full border border-line px-2 py-0.5 text-[11px] text-graphite">
                    {PROJECT_STATUS_LABELS[p.status]}
                  </span>
                </div>
                <p className="mt-1 line-clamp-2 min-h-[2.5rem] text-sm text-graphite">{p.description}</p>
                <div className="mt-3">
                  <ProgressBar done={p.doneTasks} total={p.totalTasks} color={p.color} />
                  <p className="mt-1.5 text-xs text-graphite">
                    {p.totalTasks === 0 ? "No tasks yet" : `${p.doneTasks} of ${p.totalTasks} tasks done`}
                  </p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="pm-overdue-heading">
        <h2 id="pm-overdue-heading" className="mb-3 font-display text-base text-ink">
          Overdue <span className="text-graphite">({overdue.length})</span>
        </h2>
        {overdue.length === 0 ? (
          <EmptyState title="Nothing overdue" body="Unfinished tasks whose due date has passed show up here." />
        ) : (
          <TaskRows tasks={overdue} today={today} />
        )}
      </section>

      <section aria-labelledby="pm-week-heading">
        <h2 id="pm-week-heading" className="mb-3 font-display text-base text-ink">
          Due this week <span className="text-graphite">({thisWeek.length})</span>
        </h2>
        {thisWeek.length === 0 ? (
          <EmptyState title="Nothing due this week" body="Unfinished tasks due between today and Sunday show up here." />
        ) : (
          <TaskRows tasks={thisWeek} today={today} />
        )}
      </section>

      <TaskPanelSlot taskId={searchParams.task} />
    </div>
  );
}
