"use client";

import { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";
import type { ActionResult } from "@/lib/pm/types";

type Toast = { id: number; kind: "error" | "success"; message: string };
type ToastApi = { error: (message: string) => void; success: (message: string) => void };

const ToastContext = createContext<ToastApi | null>(null);

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used inside ToastProvider");
  return ctx;
}

/**
 * Runs a server action and, if it fails for any reason (validation, server
 * error, network), calls `rollback` to undo the optimistic update and shows
 * the error. Always resolves to an ActionResult; never throws.
 */
export function useMutation() {
  const toast = useToast();
  return useCallback(
    async function mutate<T>(action: () => Promise<ActionResult<T>>, rollback?: () => void): Promise<ActionResult<T>> {
      let result: ActionResult<T>;
      try {
        result = await action();
      } catch {
        result = { ok: false, error: "Could not reach the server. Your change was not saved." };
      }
      if (!result.ok) {
        rollback?.();
        toast.error(result.error);
      }
      return result;
    },
    [toast],
  );
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(1);

  const dismiss = useCallback((id: number) => setToasts((list) => list.filter((t) => t.id !== id)), []);
  const push = useCallback(
    (kind: Toast["kind"], message: string) => {
      const id = nextId.current++;
      setToasts((list) => [...list.slice(-2), { id, kind, message }]);
      window.setTimeout(() => dismiss(id), kind === "error" ? 6000 : 2500);
    },
    [dismiss],
  );
  const api = useMemo<ToastApi>(
    () => ({ error: (m) => push("error", m), success: (m) => push("success", m) }),
    [push],
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-4 z-[70] flex flex-col items-center gap-2 px-4">
        {toasts.map((t) => (
          <div
            key={t.id}
            role={t.kind === "error" ? "alert" : "status"}
            className={`pointer-events-auto flex max-w-md items-start gap-3 rounded-lg px-4 py-3 text-sm shadow-lg ${
              t.kind === "error" ? "bg-warn text-paper" : "bg-ink text-paper"
            }`}
          >
            <span>{t.message}</span>
            <button
              type="button"
              onClick={() => dismiss(t.id)}
              aria-label="Dismiss"
              className="-mr-1 shrink-0 opacity-80 hover:opacity-100"
            >
              ✕
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
