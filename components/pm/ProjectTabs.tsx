"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { segment: "board", label: "Board" },
  { segment: "list", label: "List" },
  { segment: "timeline", label: "Timeline" },
];

export default function ProjectTabs({ slug }: { slug: string }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Project views" className="mb-5 mt-4 flex gap-1 border-b border-line text-sm">
      {TABS.map((tab) => {
        const href = `/pm/${slug}/${tab.segment}`;
        const current = pathname === href;
        return (
          <Link
            key={tab.segment}
            href={href}
            aria-current={current ? "page" : undefined}
            className={`-mb-px border-b-2 px-3 py-2 transition-colors ${
              current ? "border-accent text-ink" : "border-transparent text-graphite hover:text-ink"
            }`}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
