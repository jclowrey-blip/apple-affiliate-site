"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ActionResult, Task } from "@/lib/pm/types";
import { usePm } from "./PmContext";

/**
 * Local copy of the server's task list that can be changed immediately and
 * rolled back if the server action behind the change fails.
 *
 * - `mutate(apply, action)` applies a change now, runs the action, and on
 *   failure restores the previous list and shows the error.
 * - `setTasks` + `commit(snapshot, action)` is the same thing in two steps,
 *   for drag and drop where the list changes several times before it is saved.
 *
 * Fresh data from the server replaces the local copy whenever no action is
 * in flight.
 */
export function useOptimisticTasks(serverTasks: Task[]) {
  const { showError } = usePm();
  const [tasks, setTasksState] = useState(serverTasks);
  const tasksRef = useRef(serverTasks);
  const pending = useRef(0);

  const setTasks = useCallback((next: Task[]) => {
    tasksRef.current = next;
    setTasksState(next);
  }, []);

  useEffect(() => {
    if (pending.current === 0) setTasks(serverTasks);
  }, [serverTasks, setTasks]);

  const commit = useCallback(
    async (snapshot: Task[], action: () => Promise<ActionResult<unknown>>) => {
      pending.current++;
      let result: ActionResult<unknown>;
      try {
        result = await action();
      } catch {
        // The request itself failed (server unreachable, for example).
        result = { ok: false, error: "Couldn't reach the server. Your change was not saved." };
      }
      pending.current--;
      if (!result.ok) {
        setTasks(snapshot);
        showError(result.error);
      }
      return result.ok;
    },
    [setTasks, showError],
  );

  const mutate = useCallback(
    (apply: (tasks: Task[]) => Task[], action: () => Promise<ActionResult<unknown>>) => {
      const snapshot = tasksRef.current;
      setTasks(apply(snapshot));
      return commit(snapshot, action);
    },
    [commit, setTasks],
  );

  return { tasks, setTasks, commit, mutate };
}
