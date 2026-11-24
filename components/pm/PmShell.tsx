"use client";

// Client shell for every /pm page: top bar, project navigation, global
// keyboard shortcuts (n = quick add, Cmd/Ctrl+K = search), and the error
// toast used when a server action fails.
import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { ProjectWithProgress, TaskStatus } from "@/lib/pm/types";
import { PmContext, type PmContextValue } from "./PmContext";
import QuickAdd from "./QuickAdd";
import SearchPalette from "./SearchPalette";
import { btnPrimary, btnSecondary } from "./styles";
import { Kbd } from "./ui";

function isTyping(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName);
}

type Toast = { id: number; message: string };

export default function PmShell({ projects, children }: { projects: ProjectWithProgress[]; children: ReactNode }) {
  const params = useParams<{ project?: string }>();
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(1);
  const [quickAdd, setQuickAdd] = useState<{ status?: TaskStatus } | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [isMac, setIsMac] = useState(false);

  const openQuickAdd = useCallback((opts?: { status?: TaskStatus }) => {
    setSearchOpen(false);
    setQuickAdd(opts ?? {});
  }, []);
  const openSearch = useCallback(() => {
    setQuickAdd(null);
    setSearchOpen(true);
  }, []);

  useEffect(() => {
    setIsMac(/Mac|iPhone|iPad/.test(navigator.platform));
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && !e.altKey && !e.shiftKey && e.key.toLowerCase() === "k") {
        e.preventDefault();
        openSearch();
        return;
      }
      // "n" only when nothing else could want the keystroke: no modifier, not
      // typing in a field, and no dialog or task panel already open.
      if (e.key !== "n" || e.metaKey || e.ctrlKey || e.altKey || isTyping(e.target)) return;
      if (document.querySelector("[data-pm-overlay]")) return;
      e.preventDefault();
      openQuickAdd();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [openQuickAdd, openSearch]);

  const dismiss = useCallback((id: number) => setToasts((list) => list.filter((t) => t.id !== id)), []);
  const showError = useCallback(
    (message: string) => {
      const id = nextId.current++;
      setToasts((list) => [...list.slice(-2), { id, message }]);
      window.setTimeout(() => dismiss(id), 6000);
    },
    [dismiss],
  );

  const context = useMemo<PmContextValue>(
    () => ({ projects, showError, openQuickAdd, openSearch, openAssistant: () => {} }),
    [projects, showError, openQuickAdd, openSearch],
  );

  return (
    <PmContext.Provider value={context}>
      <header className="sticky top-0 z-40 border-b border-line bg-paper/95 backdrop-blur">
        <div className="mx-auto flex max-w-content items-center gap-3 px-4 py-3 sm:px-6">
          <Link href="/pm" className="shrink-0 font-display text-lg tracking-tight text-ink">
            projects<span className="text-accent">.</span>
          </Link>
          <nav aria-label="Projects" className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto text-sm">
            {projects.map((p) => {
              const current = params.project === p.slug;
              return (
                <Link
                  key={p.id}
                  href={`/pm/${p.slug}/board`}
                  aria-current={current ? "page" : undefined}
                  className={`flex shrink-0 items-center gap-1.5 rounded-md px-2 py-1 transition-colors ${
                    current ? "bg-line/60 text-ink" : "text-graphite hover:text-ink"
                  }`}
                >
                  <span className="h-2 w-2 rounded-full" style={{ backgroundColor: p.color }} aria-hidden />
                  {p.name}
                </Link>
              );
            })}
          </nav>
          <button type="button" className={`${btnSecondary} shrink-0`} onClick={openSearch} aria-label="Search tasks">
            <span aria-hidden>⌕</span>
            <span className="hidden sm:inline">Search</span>
            <span className="hidden md:inline">
              <Kbd>{isMac ? "⌘K" : "Ctrl K"}</Kbd>
            </span>
          </button>
          <button type="button" className={`${btnPrimary} shrink-0`} onClick={() => openQuickAdd()} aria-label="New task">
            <span aria-hidden>+</span>
            <span className="hidden sm:inline">New task</span>
            <span className="hidden rounded border border-white/40 px-1.5 py-0.5 font-mono text-[11px] leading-none md:inline">
              n
            </span>
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-content px-4 py-6 sm:px-6">{children}</main>

      {quickAdd && (
        <QuickAdd
          projects={projects}
          defaultProjectId={projects.find((p) => p.slug === params.project)?.id}
          defaultStatus={quickAdd.status}
          onClose={() => setQuickAdd(null)}
        />
      )}
      {searchOpen && <SearchPalette onClose={() => setSearchOpen(false)} />}

      <div className="pointer-events-none fixed inset-x-0 bottom-4 z-[70] flex flex-col items-center gap-2 px-4">
        {toasts.map((t) => (
          <div
            key={t.id}
            role="alert"
            className="pointer-events-auto flex max-w-md items-start gap-3 rounded-md bg-warn px-4 py-3 text-sm text-white shadow-lg"
          >
            <span>{t.message}</span>
            <button
              type="button"
              onClick={() => dismiss(t.id)}
              className="shrink-0 text-white/80 hover:text-white"
              aria-label="Dismiss"
            >
              ✕
            </button>
          </div>
        ))}
      </div>
    </PmContext.Provider>
  );
}
