"use client";

import { useEffect, useState } from "react";
import { formatMoneyFull, parseMoney } from "@/lib/pm/money";
import { usePm } from "./PmContext";

/**
 * Amount field. Accepts shorthand ("250M", "1.2B", "1,250,000"), shows the
 * exact figure once you leave it, and calls onCommit only when the value
 * actually changed.
 */
export default function MoneyInput({
  value,
  onCommit,
  label,
  className = "",
}: {
  value: number;
  onCommit: (amount: number) => void;
  label: string;
  className?: string;
}) {
  const { showError } = usePm();
  const [text, setText] = useState(formatMoneyFull(value));
  useEffect(() => setText(formatMoneyFull(value)), [value]);

  function commit() {
    const amount = text.trim() ? parseMoney(text) : 0;
    if (amount === null) {
      setText(formatMoneyFull(value));
      return showError("Enter an amount like 250M, 1.2B or 1,250,000.");
    }
    setText(formatMoneyFull(amount));
    if (amount !== value) onCommit(amount);
  }

  return (
    <input
      aria-label={label}
      className={`w-full min-w-[7rem] rounded-md border border-line bg-white px-2 py-1.5 text-right font-mono text-base tabular-nums text-ink focus:outline-none focus:ring-2 focus:ring-accent sm:text-xs ${className}`}
      value={text}
      inputMode="text"
      onChange={(e) => setText(e.target.value)}
      onFocus={(e) => e.currentTarget.select()}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") e.currentTarget.blur();
      }}
    />
  );
}
