"use client";

// Team tab: who is on the project, and the messages drafted for them. The
// tool never sends anything; each draft can be edited, copied, or opened in
// the user's own email program, then marked as sent.
import { useState, type FormEvent } from "react";
import {
  createMemberAction,
  deleteCommunicationAction,
  deleteMemberAction,
  draftTeamMessagesAction,
  updateCommunicationAction,
  updateMemberAction,
} from "@/lib/pm/actions";
import { formatDate } from "@/lib/pm/dates";
import type { UpdateMemberInput } from "@/lib/pm/schemas";
import type { Communication, DateString, TeamMember, Workstream } from "@/lib/pm/types";
import { usePm } from "./PmContext";
import { runAction } from "./runAction";
import { btnGhost, btnPrimary, btnSecondary, fieldClass, labelClass, selectClass } from "./styles";
import { EmptyState } from "./ui";

function MemberRow({ member, workstreams }: { member: TeamMember; workstreams: Workstream[] }) {
  const { showError } = usePm();
  const [name, setName] = useState(member.name);
  const [role, setRole] = useState(member.role);
  const [email, setEmail] = useState(member.email);
  const [workstreamId, setWorkstreamId] = useState(member.workstreamId ?? "");
  const [confirming, setConfirming] = useState(false);

  async function save(patch: Omit<UpdateMemberInput, "id">) {
    const result = await runAction(() => updateMemberAction({ id: member.id, ...patch }));
    if (!result.ok) {
      setName(member.name);
      setRole(member.role);
      setEmail(member.email);
      setWorkstreamId(member.workstreamId ?? "");
      showError(result.error);
    }
  }

  const text = (label: string, value: string, set: (v: string) => void, original: string, key: "name" | "role" | "email", type = "text") => (
    <input
      aria-label={`${label} for ${member.name}`}
      type={type}
      placeholder={label}
      className={`${fieldClass} min-w-0 flex-1 basis-36`}
      value={value}
      maxLength={key === "email" ? 200 : 80}
      onChange={(e) => set(e.target.value)}
      onBlur={() => {
        const next = value.trim();
        if (key === "name" && !next) return set(original);
        if (next !== original) void save({ [key]: next });
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") e.currentTarget.blur();
      }}
    />
  );

  return (
    <li className="p-3">
      <div className="flex flex-wrap items-center gap-2">
        {text("Name", name, setName, member.name, "name")}
        {text("Role", role, setRole, member.role, "role")}
        {text("Email", email, setEmail, member.email, "email", "email")}
        {workstreams.length > 0 && (
          <select
            aria-label={`Workstream for ${member.name}`}
            className={`${selectClass} max-w-[12rem] py-2`}
            value={workstreamId}
            onChange={(e) => {
              setWorkstreamId(e.target.value);
              void save({ workstreamId: e.target.value || null });
            }}
          >
            <option value="">No workstream</option>
            {workstreams.map((w) => (
              <option key={w.id} value={w.id}>
                {w.name}
              </option>
            ))}
          </select>
        )}
        {confirming ? (
          <span className="flex items-center gap-1 text-xs">
            <button
              type="button"
              className="rounded px-1.5 py-1 font-medium text-warn hover:bg-warn/10"
              onClick={async () => {
                const result = await runAction(() => deleteMemberAction({ id: member.id }));
                if (!result.ok) {
                  setConfirming(false);
                  showError(result.error);
                }
              }}
            >
              Remove
            </button>
            <button type="button" className="rounded px-1.5 py-1 text-graphite hover:bg-line" onClick={() => setConfirming(false)}>
              Keep
            </button>
          </span>
        ) : (
          <button
            type="button"
            className="flex h-8 w-8 items-center justify-center rounded text-graphite hover:bg-line hover:text-ink"
            aria-label={`Remove ${member.name}`}
            onClick={() => setConfirming(true)}
          >
            ✕
          </button>
        )}
      </div>
    </li>
  );
}

function MessageCard({ message }: { message: Communication }) {
  const { showError } = usePm();
  const [subject, setSubject] = useState(message.subject);
  const [body, setBody] = useState(message.body);
  const [copied, setCopied] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const sent = message.status === "sent";
  // Very long mailto links are cut off by some email programs; Copy always works.
  const mailto = `mailto:${message.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;

  async function save(patch: { subject?: string; body?: string; status?: "draft" | "sent" }) {
    const result = await runAction(() => updateCommunicationAction({ id: message.id, ...patch }));
    if (!result.ok) {
      setSubject(message.subject);
      setBody(message.body);
      showError(result.error);
    }
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(`Subject: ${subject}\n\n${body}`);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      showError("Couldn't copy the message. Select the text and copy it by hand.");
    }
  }

  return (
    <li className={`rounded-lg border border-line bg-white p-3 ${sent ? "opacity-70" : ""}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="min-w-0 text-sm text-ink">
          To <strong className="font-medium">{message.recipient}</strong>
          <span className="text-graphite">{message.email ? ` · ${message.email}` : " · no email address"}</span>
        </p>
        <span className={`rounded-full border px-2 py-0.5 text-[11px] font-medium ${sent ? "border-accent/40 bg-accent/10 text-accentDark" : "border-line text-graphite"}`}>
          {sent ? "Marked sent" : message.source === "generated" ? "Draft" : message.source === "assistant" ? "Draft · by the assistant" : "Draft · edited"}
        </span>
      </div>
      <input
        aria-label={`Subject of message to ${message.recipient}`}
        className={`${fieldClass} mt-2`}
        value={subject}
        maxLength={200}
        onChange={(e) => setSubject(e.target.value)}
        onBlur={() => {
          const next = subject.trim();
          if (!next) return setSubject(message.subject);
          if (next !== message.subject) void save({ subject: next });
        }}
      />
      <textarea
        aria-label={`Message to ${message.recipient}`}
        className={`${fieldClass} mt-2 font-body`}
        rows={Math.min(16, Math.max(5, body.split("\n").length + 1))}
        value={body}
        onChange={(e) => setBody(e.target.value)}
        onBlur={() => {
          if (!body.trim()) return setBody(message.body);
          if (body !== message.body) void save({ body });
        }}
      />
      <div className="mt-2 flex flex-wrap items-center justify-end gap-1">
        {confirming ? (
          <>
            <span className="mr-auto text-xs text-ink">Delete this draft?</span>
            <button type="button" className={btnGhost} onClick={() => setConfirming(false)}>
              Keep
            </button>
            <button
              type="button"
              className={`${btnGhost} text-warn hover:text-warn`}
              onClick={async () => {
                const result = await runAction(() => deleteCommunicationAction({ id: message.id }));
                if (!result.ok) {
                  setConfirming(false);
                  showError(result.error);
                }
              }}
            >
              Delete
            </button>
          </>
        ) : (
          <>
            <button type="button" className={`${btnGhost} mr-auto text-warn hover:text-warn`} onClick={() => setConfirming(true)}>
              Delete
            </button>
            <button type="button" className={btnGhost} onClick={() => void save({ status: sent ? "draft" : "sent" })}>
              {sent ? "Mark as not sent" : "Mark as sent"}
            </button>
            <button type="button" className={btnSecondary} onClick={copy}>
              {copied ? "Copied" : "Copy"}
            </button>
            {message.email && (
              <a href={mailto} className={btnPrimary}>
                Open in email
              </a>
            )}
          </>
        )}
      </div>
    </li>
  );
}

export default function TeamView({
  projectId,
  members,
  workstreams,
  messages,
  today,
}: {
  projectId: string;
  members: TeamMember[];
  workstreams: Workstream[];
  messages: Communication[];
  today: DateString;
}) {
  const { showError } = usePm();
  const [name, setName] = useState("");
  const [role, setRole] = useState("");
  const [email, setEmail] = useState("");
  const [workstreamId, setWorkstreamId] = useState("");
  const [busy, setBusy] = useState(false);
  const [drafting, setDrafting] = useState(false);

  async function add(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    const result = await runAction(() => createMemberAction({ projectId, name, role, email, workstreamId: workstreamId || null }));
    setBusy(false);
    if (!result.ok) return showError(result.error);
    setName("");
    setRole("");
    setEmail("");
  }

  async function draft() {
    setDrafting(true);
    const result = await runAction(() => draftTeamMessagesAction({ projectId }));
    setDrafting(false);
    if (!result.ok) showError(result.error);
  }

  const days = Array.from(new Set(messages.map((m) => m.forDate)));

  return (
    <div className="space-y-8">
      <section aria-labelledby="pm-team-heading">
        <h2 id="pm-team-heading" className="mb-2 font-display text-base text-ink">
          Team members
        </h2>
        {members.length === 0 ? (
          <EmptyState
            title="No team members yet"
            body="Add the people you collect updates from. Tie each to the workstream they run and the daily messages will ask them about exactly their milestones, spend and risks."
          />
        ) : (
          <ul className="divide-y divide-line rounded-lg border border-line bg-white">
            {members.map((m) => (
              <MemberRow key={JSON.stringify(m)} member={m} workstreams={workstreams} />
            ))}
          </ul>
        )}
        <form onSubmit={add} className="mt-3 flex flex-wrap items-end gap-2 rounded-lg border border-dashed border-line p-3">
          <div className="min-w-0 flex-1 basis-36">
            <label className={labelClass} htmlFor="pm-member-name">
              New team member
            </label>
            <input id="pm-member-name" className={fieldClass} placeholder="Name" value={name} maxLength={80} required onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="min-w-0 flex-1 basis-32">
            <label className={labelClass} htmlFor="pm-member-role">
              Role
            </label>
            <input id="pm-member-role" className={fieldClass} value={role} maxLength={80} onChange={(e) => setRole(e.target.value)} />
          </div>
          <div className="min-w-0 flex-1 basis-40">
            <label className={labelClass} htmlFor="pm-member-email">
              Email
            </label>
            <input id="pm-member-email" type="email" className={fieldClass} value={email} maxLength={200} onChange={(e) => setEmail(e.target.value)} />
          </div>
          {workstreams.length > 0 && (
            <div>
              <label className={labelClass} htmlFor="pm-member-ws">
                Workstream
              </label>
              <select id="pm-member-ws" className={`${selectClass} max-w-[12rem] py-2`} value={workstreamId} onChange={(e) => setWorkstreamId(e.target.value)}>
                <option value="">None</option>
                {workstreams.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name}
                  </option>
                ))}
              </select>
            </div>
          )}
          <button type="submit" className={btnPrimary} disabled={busy || !name.trim()}>
            Add member
          </button>
        </form>
      </section>

      <section aria-labelledby="pm-messages-heading">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 id="pm-messages-heading" className="font-display text-base text-ink">
              Messages
            </h2>
            <p className="text-xs text-graphite">Drafts only. Nothing is sent from here; copy a message or open it in your email program.</p>
          </div>
          <button type="button" className={btnSecondary} onClick={draft} disabled={drafting || members.length === 0}>
            {drafting ? "Drafting…" : "Draft today's update requests"}
          </button>
        </div>
        {messages.length === 0 ? (
          <EmptyState
            title="No messages drafted yet"
            body={
              members.length === 0
                ? "Add team members first. Then draft today's update requests here, or finish the day on the Daily tab to draft them along with the summary."
                : "Draft today's update requests here, or finish the day on the Daily tab to draft them along with the summary."
            }
          />
        ) : (
          days.map((d) => (
            <div key={d} className="mb-5">
              <h3 className={labelClass}>{d === today ? `Today, ${formatDate(d, { year: true })}` : formatDate(d, { year: true })}</h3>
              <ul className="space-y-3">
                {messages
                  .filter((m) => m.forDate === d)
                  .map((m) => (
                    <MessageCard key={`${m.id}:${m.status}:${m.subject.length}:${m.body.length}`} message={m} />
                  ))}
              </ul>
            </div>
          ))
        )}
      </section>
    </div>
  );
}
