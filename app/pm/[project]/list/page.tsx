import TaskTable from "@/components/pm/TaskTable";
import { todayString } from "@/lib/pm/dates";
import { listTasks } from "@/lib/pm/tasks";
import { loadProject } from "../load";

export const metadata = { title: "List" };

export default async function ListPage({ params }: { params: { project: string } }) {
  const project = await loadProject(params.project);
  const tasks = await listTasks(project.id);
  return <TaskTable tasks={tasks} today={todayString()} />;
}
