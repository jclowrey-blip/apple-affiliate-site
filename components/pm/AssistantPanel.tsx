"use client";

// Chat with the project assistant. The conversation lives in PmShell, so it
// survives moving between views; this component is only the drawer.
import { useEffect, useRef, type KeyboardEvent } from "react";
import Markdown from "./Markdown";
import { btnGhost, btnPrimary, btnSecondary } from "./styles";

export type ChatMessage = {
  role: "user" | "assistant";
  content: string;
  /** What the assistant did to produce this reply, in order. */
  steps?: string[];
  error?: boolean;
};

const SUGGESTIONS = [
  "What needs my attention this week?",
  "Which milestones have slipped, and what do they hold up?",
  "Where is the budget forecast over, and by how much?",
  "Draft this week's status report.",
];

export default function AssistantPanel({
  messages,
  draft,
  busy,
  activity,
  projectName,
  onDraft,
  onSend,
  onStop,
  onClear,
  onClose,
}: {
  messages: ChatMessage[];
  draft: string;
  busy: boolean;
  /** Steps of the reply in progress. */
  activity: string[];
  projectName?: string;
  onDraft: (text: string) => void;
  onSend: (text: string) => void;
  onStop: () => void;
  onClear: () => void;
  onClose: () => void;
}) {
  const scroller = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLTextAreaElement>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    input.current?.focus();
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === "Escape" && !document.querySelector("[data-pm-modal]")) closeRef.current();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  // Keep the newest message in view.
  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight });
  }, [messages.length, activity.length, busy]);

  function onKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      if (!busy && draft.trim()) onSend(draft);
    }
  }

  return (
    <div data-pm-overlay className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-ink/20" onClick={onClose} aria-hidden />
      <aside
        role="dialog"
        aria-modal="true"
        aria-label="Project assistant"
        className="absolute inset-y-0 right-0 flex w-full flex-col border-l border-line bg-paper shadow-xl sm:max-w-md lg:max-w-lg"
      >
        <header className="flex items-center justify-between gap-2 border-b border-line px-4 py-3">
          <div className="min-w-0">
            <h2 className="font-display text-base text-ink">Assistant</h2>
            <p className="truncate text-xs text-graphite">{projectName ? `Looking at ${projectName}` : "All projects"}</p>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            {messages.length > 0 && (
              <button type="button" className={btnGhost} onClick={onClear} disabled={busy}>
                New chat
              </button>
            )}
            <button type="button" className={btnGhost} onClick={onClose} aria-label="Close assistant">
              ✕
            </button>
          </div>
        </header>

        <div ref={scroller} className="flex-1 space-y-4 overflow-y-auto p-4" aria-live="polite">
          {messages.length === 0 && !busy && (
            <div>
              <p className="text-sm text-graphite">
                Ask about schedule, budget, risks or tasks, or tell me what to update. I read and change the same data you
                see in the tracker; I can&apos;t delete anything.
              </p>
              <ul className="mt-3 space-y-2">
                {SUGGESTIONS.map((s) => (
                  <li key={s}>
                    <button type="button" className={`${btnSecondary} w-full justify-start text-left font-normal`} onClick={() => onSend(s)}>
                      {s}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {messages.map((m, i) =>
            m.role === "user" ? (
              <div key={i} className="ml-8 whitespace-pre-wrap rounded-lg bg-accent px-3 py-2 text-sm text-white">
                {m.content}
              </div>
            ) : (
              <div key={i} className={`mr-4 rounded-lg border px-3 py-2 ${m.error ? "border-warn/40 bg-warn/5" : "border-line bg-white"}`}>
                {m.steps && m.steps.length > 0 && <Steps steps={m.steps} />}
                {m.error ? <p className="text-sm text-warn">{m.content}</p> : <Markdown source={m.content} />}
              </div>
            ),
          )}

          {busy && (
            <div className="mr-4 rounded-lg border border-line bg-white px-3 py-2" role="status">
              {activity.length > 0 && <Steps steps={activity} />}
              <p className="animate-pulse text-sm text-graphite">{activity.length ? "Working…" : "Thinking…"}</p>
            </div>
          )}
        </div>

        <form
          className="border-t border-line p-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (!busy && draft.trim()) onSend(draft);
          }}
        >
          <textarea
            ref={input}
            aria-label="Message the assistant"
            className="block max-h-48 w-full resize-none rounded-md border border-line bg-white px-3 py-2 text-base text-ink placeholder:text-graphite/70 focus:outline-none focus:ring-2 focus:ring-accent sm:text-sm"
            rows={Math.min(6, Math.max(2, draft.split("\n").length))}
            placeholder="Ask a question or describe a change"
            value={draft}
            maxLength={20000}
            onChange={(e) => onDraft(e.target.value)}
            onKeyDown={onKeyDown}
          />
          <div className="mt-2 flex items-center justify-between gap-2">
            <span className="text-xs text-graphite">Questions and the data they need are sent to the Claude API.</span>
            {busy ? (
              <button type="button" className={btnSecondary} onClick={onStop}>
                Stop
              </button>
            ) : (
              <button type="submit" className={btnPrimary} disabled={!draft.trim()}>
                Send
              </button>
            )}
          </div>
        </form>
      </aside>
    </div>
  );
}

/** The tool calls behind a reply, collapsed to one line each with repeat counts. */
function Steps({ steps }: { steps: string[] }) {
  const counted: { label: string; count: number }[] = [];
  for (const label of steps) {
    const last = counted[counted.length - 1];
    if (last?.label === label) last.count++;
    else counted.push({ label, count: 1 });
  }
  return (
    <ul className="mb-2 space-y-0.5 border-b border-line/70 pb-2 text-xs text-graphite">
      {counted.map((s, i) => (
        <li key={i}>
          ✓ {s.label}
          {s.count > 1 ? ` (${s.count})` : ""}
        </li>
      ))}
    </ul>
  );
}
