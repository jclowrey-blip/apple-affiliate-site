"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ActionResult } from "@/lib/pm/types";
import { usePm } from "./PmContext";
import { runAction } from "./runAction";

/**
 * Local copy of server data that can be changed immediately and rolled back
 * if the server action behind the change fails.
 *
 * - `mutate(apply, action)` applies a change now, runs the action, and on
 *   failure restores the previous value and shows the error.
 * - `setValue` + `commit(snapshot, action)` is the same thing in two steps,
 *   for drag and drop where the value changes several times before it is saved.
 *
 * Fresh data from the server replaces the local copy whenever no action is
 * in flight.
 */
export function useOptimisticState<T>(serverValue: T) {
  const { showError } = usePm();
  const [value, setState] = useState(serverValue);
  const valueRef = useRef(serverValue);
  const pending = useRef(0);

  const setValue = useCallback((next: T) => {
    valueRef.current = next;
    setState(next);
  }, []);

  useEffect(() => {
    if (pending.current === 0) setValue(serverValue);
  }, [serverValue, setValue]);

  const commit = useCallback(
    async (snapshot: T, action: () => Promise<ActionResult<unknown>>) => {
      pending.current++;
      const result = await runAction(action);
      pending.current--;
      if (!result.ok) {
        setValue(snapshot);
        showError(result.error);
      }
      return result.ok;
    },
    [setValue, showError],
  );

  const mutate = useCallback(
    (apply: (current: T) => T, action: () => Promise<ActionResult<unknown>>) => {
      const snapshot = valueRef.current;
      setValue(apply(snapshot));
      return commit(snapshot, action);
    },
    [commit, setValue],
  );

  return { value, setValue, commit, mutate };
}
