import type { Metadata } from "next";
import { notFound } from "next/navigation";
import ListTable from "@/components/pm/ListTable";
import TaskPanelLoader from "@/components/pm/TaskPanelLoader";
import { todayISO } from "@/lib/pm/dates";
import { getProjectBySlug } from "@/lib/pm/projects";
import { listTasks } from "@/lib/pm/tasks";

export const metadata: Metadata = { title: "List" };

export default async function ListPage({
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
      <ListTable tasks={tasks} today={todayISO()} />
      <TaskPanelLoader taskId={searchParams.task} />
    </>
  );
}
