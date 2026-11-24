"use client";

import { useState } from "react";
import { btnDanger, btnGhost, btnSecondary } from "./ui";

/** A destructive button that asks for a second, explicit click before acting. */
export default function ConfirmButton({
  label,
  question,
  confirmLabel = "Delete",
  onConfirm,
  className = btnGhost,
}: {
  label: string;
  question: string;
  confirmLabel?: string;
  onConfirm: () => void | Promise<void>;
  className?: string;
}) {
  const [asking, setAsking] = useState(false);
  const [busy, setBusy] = useState(false);

  if (!asking) {
    return (
      <button type="button" className={className} onClick={() => setAsking(true)}>
        {label}
      </button>
    );
  }
  return (
    <div role="alertdialog" aria-label={question} className="flex flex-wrap items-center gap-2 rounded-md border border-warn/40 bg-warn/5 p-2">
      <span className="text-sm text-ink">{question}</span>
      <button type="button" className={btnSecondary} onClick={() => setAsking(false)} disabled={busy} autoFocus>
        Cancel
      </button>
      <button
        type="button"
        className={btnDanger}
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          await onConfirm();
          setBusy(false);
          setAsking(false);
        }}
      >
        {confirmLabel}
      </button>
    </div>
  );
}
