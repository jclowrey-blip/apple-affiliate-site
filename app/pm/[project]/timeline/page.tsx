import type { Metadata } from "next";
import { notFound } from "next/navigation";
import TaskPanelLoader from "@/components/pm/TaskPanelLoader";
import Timeline from "@/components/pm/Timeline";
import { todayISO } from "@/lib/pm/dates";
import { listMilestones } from "@/lib/pm/milestones";
import { getProjectBySlug } from "@/lib/pm/projects";
import { listTasks } from "@/lib/pm/tasks";

export const metadata: Metadata = { title: "Timeline" };

export default async function TimelinePage({
  params,
  searchParams,
}: {
  params: { project: string };
  searchParams: { task?: string | string[] };
}) {
  const project = await getProjectBySlug(params.project);
  if (!project) notFound();
  const [tasks, milestones] = await Promise.all([listTasks(project.id), listMilestones(project.id)]);
  return (
    <>
      <Timeline projectId={project.id} tasks={tasks} milestones={milestones} today={todayISO()} />
      <TaskPanelLoader taskId={searchParams.task} />
    </>
  );
}
