import Link from "next/link";
import EmptyState from "@/components/pm/EmptyState";

export default function PmNotFound() {
  return (
    <div className="mx-auto max-w-md py-10">
      <EmptyState
        title="Project not found"
        action={
          <Link href="/pm" className="text-sm text-accent underline">
            Back to all projects
          </Link>
        }
      >
        It may have been deleted, or the link is wrong.
      </EmptyState>
    </div>
  );
}
