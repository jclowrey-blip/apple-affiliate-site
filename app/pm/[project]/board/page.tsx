import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Board from "@/components/pm/Board";
import { todayISO } from "@/lib/pm/dates";
import { getProjectBySlug } from "@/lib/pm/projects";
import { listTasks } from "@/lib/pm/tasks";

export const metadata: Metadata = { title: "Board" };

export default async function BoardPage({ params }: { params: { project: string } }) {
  const project = await getProjectBySlug(params.project);
  if (!project) notFound();
  const tasks = await listTasks(project.id);
  return <Board tasks={tasks} today={todayISO()} />;
}
