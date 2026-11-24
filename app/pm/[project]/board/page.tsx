import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Board from "@/components/pm/Board";
import TaskPanelLoader from "@/components/pm/TaskPanelLoader";
import { todayISO } from "@/lib/pm/dates";
import { getProjectBySlug } from "@/lib/pm/projects";
import { listTasks } from "@/lib/pm/tasks";

export const metadata: Metadata = { title: "Board" };

export default async function BoardPage({
  params,
  searchParams,
}: {
  params: { project: string };
  searchParams: { task?: string | string[] };
}) {
  const project = await getProjectBySlug(params.project);
  if (!project) notFound();
  const tasks = await listTasks(project.id);
  return (
    <>
      <Board tasks={tasks} today={todayISO()} />
      <TaskPanelLoader taskId={searchParams.task} />
    </>
  );
}
