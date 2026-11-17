import { notFound } from "next/navigation";
import { cache } from "react";
import { getProjectBySlug } from "@/lib/pm/projects";

/** Loads the project for the current route once per request, or 404s. */
export const loadProject = cache(async (slug: string) => {
  const project = await getProjectBySlug(slug);
  if (!project) notFound();
  return project;
});
