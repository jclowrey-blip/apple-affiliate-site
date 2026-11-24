"use client";

import Link from "next/link";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ProjectRef, TaskStatus } from "@/lib/pm/types";
import { isTypingTarget } from "./hooks";
import QuickAdd from "./QuickAdd";
import SearchPalette from "./SearchPalette";
import { ToastProvider } from "./Toast";
import { btnPrimary, btnSecondary, kbdCls } from "./ui";

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

  const [searching, setSearching] = useState(false);
  const [isMac, setIsMac] = useState(false);

  const openQuickAdd = useCallback((status?: TaskStatus) => setQuickAdd({ status }), []);

  // Global shortcuts: Cmd/Ctrl+K searches from anywhere; "n" adds a task
  // unless the user is typing in a field or another dialog is already open.
  useEffect(() => {
    setIsMac(/Mac|iPhone|iPad/.test(navigator.platform));
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && !e.altKey && !e.shiftKey && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setQuickAdd(null);
        setSearching(true);
        return;
      }
      if (e.key.toLowerCase() !== "n" || e.metaKey || e.ctrlKey || e.altKey) return;
      if (isTypingTarget(e.target) || document.querySelector("[data-pm-dialog]")) return;
      e.preventDefault();
      setQuickAdd({});
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);
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
              <button type="button" className={btnSecondary} onClick={() => setSearching(true)} aria-keyshortcuts="Meta+K Control+K">
                <span>Search</span>
                <kbd className={kbdCls}>{isMac ? "⌘K" : "Ctrl K"}</kbd>
              </button>
              <button type="button" className={btnPrimary} onClick={() => openQuickAdd()} aria-keyshortcuts="N">
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
        {searching && <SearchPalette onClose={() => setSearching(false)} />}
        {quickAdd && <QuickAdd projects={projects} initialStatus={quickAdd.status} onClose={() => setQuickAdd(null)} />}
      </PmContext.Provider>
    </ToastProvider>
  );
}
