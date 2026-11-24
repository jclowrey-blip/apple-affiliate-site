"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { view: "board", label: "Board" },
  { view: "list", label: "List" },
  { view: "timeline", label: "Timeline" },
];

export default function ProjectTabs({ slug }: { slug: string }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Project views" className="-mb-px flex gap-1">
      {TABS.map(({ view, label }) => {
        const href = `/pm/${slug}/${view}`;
        const active = pathname === href;
        return (
          <Link
            key={view}
            href={href}
            aria-current={active ? "page" : undefined}
            className={`border-b-2 px-3 py-2 text-sm transition-colors ${
              active ? "border-accent font-medium text-ink" : "border-transparent text-graphite hover:text-ink"
            }`}
          >
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
