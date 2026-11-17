import TaskTable from "@/components/pm/TaskTable";
import TaskPanelSlot from "@/components/pm/TaskPanelSlot";
import { todayString } from "@/lib/pm/dates";
import { listTasks } from "@/lib/pm/tasks";
import { loadProject } from "../load";

export const metadata = { title: "List" };

export default async function ListPage({
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
      <TaskTable tasks={tasks} today={todayString()} />
      <TaskPanelSlot taskId={searchParams.task} />
    </>
  );
}
