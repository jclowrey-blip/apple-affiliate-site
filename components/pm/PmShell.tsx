"use client";

import Link from "next/link";
import { createContext, useCallback, useContext, useMemo, useState } from "react";
import type { ProjectRef, TaskStatus } from "@/lib/pm/types";
import QuickAdd from "./QuickAdd";
import { ToastProvider } from "./Toast";
import { btnPrimary, kbdCls } from "./ui";

type PmContextValue = {
  projects: ProjectRef[];
  openQuickAdd: (status?: TaskStatus) => void;
};

const PmContext = createContext<PmContextValue | null>(null);

export function usePm(): PmContextValue {
  const ctx = useContext(PmContext);
  if (!ctx) throw new Error("usePm must be used inside PmShell");
  return ctx;
}

/** Client chrome for every /pm page: top bar, toasts, and the global overlays. */
export default function PmShell({ projects, children }: { projects: ProjectRef[]; children: React.ReactNode }) {
  const [quickAdd, setQuickAdd] = useState<{ status?: TaskStatus } | null>(null);

  const openQuickAdd = useCallback((status?: TaskStatus) => setQuickAdd({ status }), []);
  const ctx = useMemo(() => ({ projects, openQuickAdd }), [projects, openQuickAdd]);

  return (
    <ToastProvider>
      <PmContext.Provider value={ctx}>
        <div className="flex min-h-screen flex-col">
          <header className="sticky top-0 z-30 border-b border-line bg-paper/95 backdrop-blur">
            <div className="mx-auto flex w-full max-w-[90rem] items-center gap-2 px-4 py-3 sm:px-6">
              <Link href="/pm" className="font-display text-base tracking-tight text-ink">
                orchard<span className="text-accent">.</span> <span className="text-graphite">projects</span>
              </Link>
              <div className="flex-1" />
              <button type="button" className={btnPrimary} onClick={() => openQuickAdd()}>
                <span aria-hidden="true">+</span>
                <span>
                  New<span className="hidden sm:inline"> task</span>
                </span>
                <kbd className={`${kbdCls} !border-paper/40 !bg-transparent !text-paper`}>N</kbd>
              </button>
            </div>
          </header>
          <div className="mx-auto w-full max-w-[90rem] flex-1 px-4 py-6 sm:px-6">{children}</div>
        </div>
        {quickAdd && <QuickAdd projects={projects} initialStatus={quickAdd.status} onClose={() => setQuickAdd(null)} />}
      </PmContext.Provider>
    </ToastProvider>
  );
}
