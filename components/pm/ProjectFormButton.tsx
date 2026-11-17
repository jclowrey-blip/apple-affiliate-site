"use client";

import { useState } from "react";
import type { Project } from "@/lib/pm/types";
import ProjectForm from "./ProjectForm";

/** A button that opens the create/edit project dialog. */
export default function ProjectFormButton({
  project,
  className,
  children,
}: {
  project?: Project;
  className: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" className={className} onClick={() => setOpen(true)}>
        {children}
      </button>
      {open && <ProjectForm project={project} onClose={() => setOpen(false)} />}
    </>
  );
}
