"use client";

import { useEffect, useRef } from "react";

/** Minimal accessible dialog: Escape and backdrop click close it, focus returns to the opener. */
export default function Modal({
  label,
  onClose,
  children,
  align = "top",
}: {
  label: string;
  onClose: () => void;
  children: React.ReactNode;
  align?: "top" | "center";
}) {
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        closeRef.current();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      opener?.focus?.();
    };
  }, []);

  return (
    <div
      className={`fixed inset-0 z-[60] flex justify-center bg-ink/40 p-4 ${
        align === "top" ? "items-start pt-[10vh]" : "items-center"
      }`}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={label}
        data-pm-dialog
        className="max-h-[80vh] w-full max-w-lg overflow-y-auto rounded-xl border border-line bg-paper shadow-2xl"
      >
        {children}
      </div>
    </div>
  );
}
