import RiskRegister from "@/components/pm/RiskRegister";
import { todayString } from "@/lib/pm/dates";
import { listRisks } from "@/lib/pm/risks";
import { listWorkstreams } from "@/lib/pm/workstreams";
import { loadProject } from "../load";

export const metadata = { title: "Risks" };

export default async function RisksPage({ params }: { params: { project: string } }) {
  const project = await loadProject(params.project);
  const [risks, workstreams] = await Promise.all([listRisks(project.id), listWorkstreams(project.id)]);
  return <RiskRegister projectId={project.id} risks={risks} workstreams={workstreams} today={todayString()} />;
}
