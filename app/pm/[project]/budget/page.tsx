import BudgetTable from "@/components/pm/BudgetTable";
import { listBudgetLines } from "@/lib/pm/budget";
import { listWorkstreams } from "@/lib/pm/workstreams";
import { loadProject } from "../load";

export const metadata = { title: "Budget" };

export default async function BudgetPage({ params }: { params: { project: string } }) {
  const project = await loadProject(params.project);
  const [workstreams, lines] = await Promise.all([listWorkstreams(project.id), listBudgetLines(project.id)]);
  return <BudgetTable project={project} workstreams={workstreams} lines={lines} />;
}
