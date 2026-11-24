import type { Metadata } from "next";
import "../globals.css";
import PmShell from "@/components/pm/PmShell";
import { authEnabled, hasAccess } from "@/lib/pm/access";
import { listProjects } from "@/lib/pm/projects";

// Private tool: never indexed, never cached, and not linked from the storefront.
export const metadata: Metadata = {
  title: { default: "Projects", template: "%s · Projects" },
  robots: { index: false, follow: false, nocache: true },
};

export const dynamic = "force-dynamic";

// Root layout for everything under /pm (the storefront has its own in
// app/(storefront)). hasAccess() is the access gate; to add auth later,
// change its body in lib/pm/access.ts.
//
// Without access the layout renders a bare document and loads no data. The
// page inside it then redirects to /pm/login when a password is set, or
// responds with a 404 (each page calls requireAccess()). The sign-in page is
// the only one that renders in this bare document. The layout does not call notFound()
// itself because a root layout has nothing above it to render the 404 into.
export default async function PmLayout({ children }: { children: React.ReactNode }) {
  if (!(await hasAccess())) {
    return (
      <html lang="en">
        <body>
          <main className="mx-auto max-w-content px-4 py-6 sm:px-6">{children}</main>
        </body>
      </html>
    );
  }
  const projects = await listProjects();

  return (
    <html lang="en">
      <body>
        <PmShell projects={projects} canSignOut={authEnabled()}>
          {children}
        </PmShell>
      </body>
    </html>
  );
}
