"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { searchTasksAction } from "@/lib/pm/actions";
import type { SearchResult } from "@/lib/pm/types";
import { runAction } from "./runAction";
import { Kbd, Modal, StatusBadge } from "./ui";

/** Global task search (Cmd/Ctrl+K). Picking a result opens that task's panel. */
export default function SearchPalette({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const pathname = usePathname();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [state, setState] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [selected, setSelected] = useState(0);
  const request = useRef(0);

  useEffect(() => {
    const q = query.trim();
    const id = ++request.current;
    if (!q) {
      setResults([]);
      setState("idle");
      return;
    }
    setState("loading");
    const timer = window.setTimeout(async () => {
      const result = await runAction(() => searchTasksAction({ query: q }));
      if (id !== request.current) return; // a newer query has been typed
      setResults(result.ok ? result.data : []);
      setSelected(0);
      setState(result.ok ? "done" : "error");
    }, 150);
    return () => window.clearTimeout(timer);
  }, [query]);

  function open(result: SearchResult) {
    // Stay on the current view if it already belongs to the task's project.
    const base = `/pm/${result.project.slug}/`;
    const view = pathname.startsWith(base) ? pathname : `${base}board`;
    router.push(`${view}?task=${result.id}`, { scroll: false });
    onClose();
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelected((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelected((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter" && results[selected]) {
      e.preventDefault();
      open(results[selected]);
    }
  }

  return (
    <Modal title="Search tasks" onClose={onClose} position="top">
      <div className="border-b border-line p-3">
        <input
          className="w-full bg-transparent px-1 text-base text-ink placeholder:text-graphite/70 focus:outline-none"
          placeholder="Search tasks in every project"
          aria-label="Search tasks"
          role="combobox"
          aria-expanded={results.length > 0}
          aria-controls="pm-search-results"
          aria-activedescendant={results[selected] ? `pm-search-${results[selected].id}` : undefined}
          value={query}
          maxLength={100}
          autoFocus
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={onKeyDown}
        />
      </div>
      {results.length > 0 ? (
        <ul id="pm-search-results" role="listbox" className="max-h-[50vh] overflow-y-auto p-1">
          {results.map((r, i) => (
            <li
              key={r.id}
              id={`pm-search-${r.id}`}
              role="option"
              aria-selected={i === selected}
              onMouseEnter={() => setSelected(i)}
              onClick={() => open(r)}
              className={`cursor-pointer rounded-md px-3 py-2 ${i === selected ? "bg-line/60" : ""}`}
            >
              <div className="flex items-center justify-between gap-3">
                <span className="min-w-0 truncate text-sm text-ink">{r.title}</span>
                <StatusBadge status={r.status} />
              </div>
              <div className="mt-0.5 flex items-center gap-1.5 text-xs text-graphite">
                <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: r.project.color }} aria-hidden />
                <span className="shrink-0">{r.project.name}</span>
                {r.snippet && <span className="min-w-0 truncate">· {r.snippet}</span>}
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="px-4 py-6 text-center text-sm text-graphite" aria-live="polite">
          {state === "idle" && "Type to search task titles and descriptions."}
          {state === "loading" && "Searching…"}
          {state === "done" && `No tasks match “${query.trim()}”.`}
          {state === "error" && "Search isn't working right now. Try again."}
        </p>
      )}
      <div className="hidden items-center gap-3 border-t border-line px-4 py-2 text-xs text-graphite sm:flex">
        <span>
          <Kbd>↑</Kbd> <Kbd>↓</Kbd> to move
        </span>
        <span>
          <Kbd>Enter</Kbd> to open
        </span>
        <span>
          <Kbd>Esc</Kbd> to close
        </span>
      </div>
    </Modal>
  );
}
