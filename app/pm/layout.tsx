import type { Metadata } from "next";
import PmShell from "@/components/pm/PmShell";
import { requirePmAccess } from "@/lib/pm/access";
import { listProjects } from "@/lib/pm/projects";

// Private tool: keep every /pm page out of search indexes. Child pages inherit this.
export const metadata: Metadata = {
  title: { default: "Projects", template: "%s · Projects" },
  description: "Private project management.",
  robots: { index: false, follow: false, nocache: true, googleBot: { index: false, follow: false } },
};

// Always render from the database at request time; nothing under /pm is prerendered.
export const dynamic = "force-dynamic";

export default async function PmLayout({ children }: { children: React.ReactNode }) {
  // The single gate for the whole tool. Add authentication inside requirePmAccess().
  await requirePmAccess();

  const projects = await listProjects();
  return (
    <PmShell projects={projects.map(({ id, slug, name, color }) => ({ id, slug, name, color }))}>{children}</PmShell>
  );
}
