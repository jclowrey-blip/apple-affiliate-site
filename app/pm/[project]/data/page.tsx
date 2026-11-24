import DataExchange from "@/components/pm/DataExchange";
import { loadProject } from "../load";

export const metadata = { title: "Import / export" };

export default async function DataPage({ params }: { params: { project: string } }) {
  const project = await loadProject(params.project);
  return <DataExchange project={project} />;
}
