"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { searchTasksAction } from "@/lib/pm/actions";
import type { SearchResult } from "@/lib/pm/types";
import { StatusBadge } from "./Badges";
import { useTaskHref } from "./hooks";
import Modal from "./Modal";
import { inputCls } from "./ui";

/** Global search over task titles and descriptions (Cmd/Ctrl+K). */
export default function SearchPalette({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const taskHref = useTaskHref();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [state, setState] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [active, setActive] = useState(0);
  const latest = useRef(0);

  useEffect(() => {
    const q = query.trim();
    const request = ++latest.current;
    if (!q) {
      setResults([]);
      setState("idle");
      return;
    }
    setState("loading");
    const timer = window.setTimeout(async () => {
      let next: SearchResult[] | null = null;
      try {
        const result = await searchTasksAction({ query: q });
        if (result.ok) next = result.data;
      } catch {
        next = null;
      }
      if (request !== latest.current) return; // a newer query superseded this one
      setResults(next ?? []);
      setActive(0);
      setState(next ? "done" : "error");
    }, 150);
    return () => window.clearTimeout(timer);
  }, [query]);

  function openResult(result: SearchResult) {
    onClose();
    router.push(taskHref(result.id), { scroll: false });
  }

  return (
    <Modal label="Search tasks" onClose={onClose}>
      <div className="border-b border-line p-3">
        <input
          role="combobox"
          aria-label="Search tasks"
          aria-expanded={results.length > 0}
          aria-controls="pm-search-results"
          aria-activedescendant={results[active] ? `pm-search-${results[active].id}` : undefined}
          className={`${inputCls} !text-base`}
          placeholder="Search task titles and descriptions"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setActive((i) => Math.min(i + 1, results.length - 1));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setActive((i) => Math.max(i - 1, 0));
            } else if (e.key === "Enter" && results[active]) {
              e.preventDefault();
              openResult(results[active]);
            }
          }}
          autoFocus
        />
      </div>
      {results.length > 0 ? (
        <ul id="pm-search-results" role="listbox" aria-label="Results" className="p-1.5">
          {results.map((result, i) => (
            <li
              key={result.id}
              id={`pm-search-${result.id}`}
              role="option"
              aria-selected={i === active}
              onMouseEnter={() => setActive(i)}
              onClick={() => openResult(result)}
              className={`cursor-pointer rounded-md px-3 py-2 ${i === active ? "bg-line/60" : ""}`}
            >
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: result.project.color }} aria-hidden="true" />
                <span className="min-w-0 flex-1 truncate text-sm text-ink">{result.title}</span>
                <StatusBadge status={result.status} />
              </div>
              <p className="mt-0.5 truncate pl-4 text-xs text-graphite">
                {result.project.name}
                {result.snippet && ` · ${result.snippet}`}
              </p>
            </li>
          ))}
        </ul>
      ) : (
        <p id="pm-search-results" className="px-4 py-6 text-center text-sm text-graphite" role="status">
          {state === "idle" && "Type to search every project. Use ↑ ↓ and Enter to open a task."}
          {state === "loading" && "Searching…"}
          {state === "done" && `No tasks match “${query.trim()}”.`}
          {state === "error" && "Search failed. Try again."}
        </p>
      )}
    </Modal>
  );
}
