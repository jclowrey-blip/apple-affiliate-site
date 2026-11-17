import type { ActionResult } from "@/lib/pm/types";

/**
 * Awaits a server action and turns a failed request (server unreachable,
 * for example) into the same error shape the actions themselves return.
 */
export async function runAction<T>(action: () => Promise<ActionResult<T>>): Promise<ActionResult<T>> {
  try {
    return await action();
  } catch {
    return { ok: false, error: "Couldn't reach the server. Your change was not saved." };
  }
}
