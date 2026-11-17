"use client";

import { createContext, useContext } from "react";
import type { ProjectWithProgress, TaskStatus } from "@/lib/pm/types";

export type PmContextValue = {
  projects: ProjectWithProgress[];
  /** Show an error message at the bottom of the screen. */
  showError: (message: string) => void;
  /** Open the quick-add task input, optionally preset to a status column. */
  openQuickAdd: (opts?: { status?: TaskStatus }) => void;
  openSearch: () => void;
};

export const PmContext = createContext<PmContextValue | null>(null);

export function usePm(): PmContextValue {
  const value = useContext(PmContext);
  if (!value) throw new Error("usePm must be used inside PmShell");
  return value;
}
