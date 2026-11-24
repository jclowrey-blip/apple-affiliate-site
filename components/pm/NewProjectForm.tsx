"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { createProjectAction } from "@/lib/pm/actions";
import { PROJECT_COLORS } from "@/lib/pm/types";
import { useMutation } from "./Toast";
import { btnPrimary, btnSecondary, inputCls, labelCls } from "./ui";

export function ColorPicker({ value, onChange }: { value: string; onChange: (color: string) => void }) {
  return (
    <div role="radiogroup" aria-label="Color" className="flex flex-wrap gap-2">
      {PROJECT_COLORS.map((color) => (
        <button
          key={color}
          type="button"
          role="radio"
          aria-checked={value === color}
          aria-label={`Color ${color}`}
          onClick={() => onChange(color)}
          className={`h-7 w-7 rounded-full border-2 ${value === color ? "border-ink" : "border-transparent"}`}
          style={{ backgroundColor: color }}
        />
      ))}
    </div>
  );
}

export default function NewProjectForm({ defaultOpen = false }: { defaultOpen?: boolean }) {
  const router = useRouter();
  const mutate = useMutation();
  const [open, setOpen] = useState(defaultOpen);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [color, setColor] = useState<string>(PROJECT_COLORS[0]);
  const [busy, setBusy] = useState(false);

  if (!open) {
    return (
      <button type="button" className={btnPrimary} onClick={() => setOpen(true)}>
        New project
      </button>
    );
  }

  return (
    <form
      className="w-full space-y-3 rounded-lg border border-line bg-white p-4 sm:max-w-md"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        const result = await mutate(() => createProjectAction({ name, description, color }));
        setBusy(false);
        if (result.ok) router.push(`/pm/${result.data.slug}/board`);
      }}
    >
      <div>
        <label htmlFor="new-project-name" className={labelCls}>
          Project name
        </label>
        <input
          id="new-project-name"
          className={inputCls}
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={80}
          required
          autoFocus
        />
      </div>
      <div>
        <label htmlFor="new-project-description" className={labelCls}>
          Description
        </label>
        <textarea
          id="new-project-description"
          className={inputCls}
          rows={2}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
      </div>
      <ColorPicker value={color} onChange={setColor} />
      <div className="flex gap-2">
        <button type="submit" className={btnPrimary} disabled={busy || !name.trim()}>
          Create project
        </button>
        <button type="button" className={btnSecondary} onClick={() => setOpen(false)}>
          Cancel
        </button>
      </div>
    </form>
  );
}
