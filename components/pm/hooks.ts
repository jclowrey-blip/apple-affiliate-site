"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useCallback, useState } from "react";

/**
 * Local state that resets whenever the server sends a new value. Lets a view
 * apply optimistic changes immediately while still following server refreshes.
 */
export function useSyncedState<T>(serverValue: T) {
  const [value, setValue] = useState(serverValue);
  const [seen, setSeen] = useState(serverValue);
  if (seen !== serverValue) {
    setSeen(serverValue);
    setValue(serverValue);
  }
  return [value, setValue] as const;
}

/** Builds the shareable URL that opens a task's side panel over the current view. */
export function useTaskHref() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  return useCallback(
    (taskId: string | null) => {
      const params = new URLSearchParams(searchParams.toString());
      if (taskId) params.set("task", taskId);
      else params.delete("task");
      const query = params.toString();
      return query ? `${pathname}?${query}` : pathname;
    },
    [pathname, searchParams],
  );
}

export function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName);
}
