import { redirect } from "next/navigation";
import { requireAccess } from "@/lib/pm/access";

export default async function ProjectIndex({ params }: { params: { project: string } }) {
  await requireAccess();
  redirect(`/pm/${params.project}/board`);
}
