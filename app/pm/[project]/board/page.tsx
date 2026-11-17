import Board from "@/components/pm/Board";
import { todayString } from "@/lib/pm/dates";
import { listTasks } from "@/lib/pm/tasks";
import { loadProject } from "../load";

export const metadata = { title: "Board" };

export default async function BoardPage({ params }: { params: { project: string } }) {
  const project = await loadProject(params.project);
  const tasks = await listTasks(project.id);
  return <Board tasks={tasks} today={todayString()} />;
}
