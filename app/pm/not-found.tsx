import Link from "next/link";
import { btnSecondary } from "@/components/pm/styles";

// Shown inside the /pm shell when a project URL doesn't match anything.
export default function PmNotFound() {
  return (
    <div className="rounded-lg border border-dashed border-line px-6 py-12 text-center">
      <p className="font-display text-base text-ink">Project not found</p>
      <p className="mx-auto mt-1 max-w-sm text-sm text-graphite">
        It may have been deleted, or the link is wrong.
      </p>
      <div className="mt-4 flex justify-center">
        <Link href="/pm" className={btnSecondary}>
          Back to dashboard
        </Link>
      </div>
    </div>
  );
}
