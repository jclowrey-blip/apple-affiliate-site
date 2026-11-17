"use client";

// Client shell for every /pm page: top bar, project navigation, and the
// error toast used when a server action fails.
import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { ProjectWithProgress } from "@/lib/pm/types";
import { PmContext, type PmContextValue } from "./PmContext";

type Toast = { id: number; message: string };

export default function PmShell({ projects, children }: { projects: ProjectWithProgress[]; children: ReactNode }) {
  const params = useParams<{ project?: string }>();
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(1);

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
    () => ({ projects, showError, openQuickAdd: () => {}, openSearch: () => {} }),
    [projects, showError],
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
        </div>
      </header>

      <main className="mx-auto max-w-content px-4 py-6 sm:px-6">{children}</main>

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
