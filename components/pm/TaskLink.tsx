"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import type { ReactNode } from "react";

/** Builds the URL that opens a task's side panel over the current view. */
export function useTaskHref(): (taskId: string) => string {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  return (taskId) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("task", taskId);
    return `${pathname}?${params.toString()}`;
  };
}

export default function TaskLink({
  taskId,
  className,
  children,
}: {
  taskId: string;
  className?: string;
  children: ReactNode;
}) {
  const href = useTaskHref();
  return (
    <Link href={href(taskId)} scroll={false} className={className} draggable={false}>
      {children}
    </Link>
  );
}
