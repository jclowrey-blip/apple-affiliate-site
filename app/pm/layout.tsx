import type { Metadata } from "next";
import { notFound } from "next/navigation";
import "../globals.css";
import PmShell from "@/components/pm/PmShell";
import { hasAccess } from "@/lib/pm/access";
import { listProjects } from "@/lib/pm/projects";

// Private tool: never indexed, never cached, and not linked from the storefront.
export const metadata: Metadata = {
  title: { default: "Projects", template: "%s · Projects" },
  robots: { index: false, follow: false, nocache: true },
};

export const dynamic = "force-dynamic";

// Root layout for everything under /pm (the storefront has its own in
// app/(storefront)). This is the one place to add an auth check later:
// see lib/pm/access.ts.
export default async function PmLayout({ children }: { children: React.ReactNode }) {
  if (!hasAccess()) notFound();
  const projects = await listProjects();

  return (
    <html lang="en">
      <body>
        <PmShell projects={projects}>{children}</PmShell>
      </body>
    </html>
  );
}
