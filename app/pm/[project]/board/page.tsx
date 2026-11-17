import Board from "@/components/pm/Board";
import TaskPanelSlot from "@/components/pm/TaskPanelSlot";
import { todayString } from "@/lib/pm/dates";
import { listTasks } from "@/lib/pm/tasks";
import { loadProject } from "../load";

export const metadata = { title: "Board" };

export default async function BoardPage({
  params,
  searchParams,
}: {
  params: { project: string };
  searchParams: { task?: string | string[] };
}) {
  const project = await loadProject(params.project);
  const tasks = await listTasks(project.id);
  return (
    <>
      <Board tasks={tasks} today={todayString()} />
      <TaskPanelSlot taskId={searchParams.task} />
    </>
  );
}
