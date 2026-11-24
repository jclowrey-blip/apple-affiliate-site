"use client";

import { useRouter } from "next/navigation";
import { useCallback, useRef, useState } from "react";
import type { AssistantEvent } from "@/lib/pm/assistant/events";
import type { ChatMessage } from "./AssistantPanel";

/**
 * Conversation state for the assistant plus the request that drives it.
 * Sends the text of the conversation so far, reads the reply as a stream of
 * events, and refreshes the page data when the assistant changed something.
 */
export function useAssistant(project?: string) {
  const router = useRouter();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [activity, setActivity] = useState<string[]>([]);
  const abort = useRef<AbortController | null>(null);

  const send = useCallback(
    async (text: string) => {
      const content = text.trim();
      if (!content || abort.current) return;
      // Failed replies are shown but not sent back as conversation history.
      const history = [...messages.filter((m) => !m.error), { role: "user" as const, content }];
      setMessages((list) => [...list, { role: "user", content }]);
      setDraft("");
      setBusy(true);
      setActivity([]);

      const controller = new AbortController();
      abort.current = controller;
      const steps: string[] = [];
      let reply: ChatMessage | null = null;
      let mutated = false;

      try {
        const response = await fetch("/pm/api/assistant", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ messages: history.map(({ role, content }) => ({ role, content })), project }),
          signal: controller.signal,
        });
        if (!response.ok || !response.body) {
          const detail = await response.json().catch(() => null);
          throw new Error(detail?.error ?? "The assistant isn't available right now.");
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        for (;;) {
          const { done, value } = await reader.read();
          buffer += decoder.decode(value, { stream: !done });
          const lines = buffer.split("\n");
          buffer = done ? "" : (lines.pop() ?? "");
          for (const line of lines) {
            if (!line.trim()) continue;
            const event = JSON.parse(line) as AssistantEvent;
            if (event.type === "tool") {
              steps.push(event.label);
              setActivity([...steps]);
            } else if (event.type === "final") {
              reply = { role: "assistant", content: event.text, steps: [...steps] };
              mutated = event.mutated;
            } else {
              reply = { role: "assistant", content: event.message, steps: [...steps], error: true };
              mutated = steps.length > 0;
            }
          }
          if (done) break;
        }
        reply ??= { role: "assistant", content: "The reply was cut off before it finished. Try again.", steps: [...steps], error: true };
      } catch (error) {
        reply = controller.signal.aborted
          ? { role: "assistant", content: "Stopped. Anything listed above was already done.", steps: [...steps], error: true }
          : { role: "assistant", content: error instanceof Error && error.message ? error.message : "Couldn't reach the assistant.", steps: [...steps], error: true };
        mutated = steps.length > 0;
      } finally {
        abort.current = null;
        setBusy(false);
        setActivity([]);
      }

      setMessages((list) => [...list, reply!]);
      if (mutated) router.refresh();
    },
    [messages, project, router],
  );

  const stop = useCallback(() => abort.current?.abort(), []);
  const clear = useCallback(() => setMessages([]), []);

  return { messages, draft, setDraft, busy, activity, send, stop, clear };
}
