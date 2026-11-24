import ReportsView from "@/components/pm/ReportsView";
import { todayString } from "@/lib/pm/dates";
import { listReports } from "@/lib/pm/reports";
import { loadProject } from "../load";

export const metadata = { title: "Reports" };

export default async function ReportsPage({ params }: { params: { project: string } }) {
  const project = await loadProject(params.project);
  const reports = await listReports(project.id);
  return <ReportsView project={project} reports={reports} today={todayString()} />;
}
