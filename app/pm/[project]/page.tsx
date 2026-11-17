import { redirect } from "next/navigation";

export default function ProjectIndex({ params }: { params: { project: string } }) {
  redirect(`/pm/${params.project}/board`);
}
