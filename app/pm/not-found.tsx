import Link from "next/link";
import { btnSecondary } from "@/components/pm/styles";
import { hasAccess } from "@/lib/pm/access";

// 404 for everything under /pm: an unknown project URL, or any /pm URL when
// access is not allowed (in which case it says nothing about the tool).
export default async function PmNotFound() {
  const allowed = await hasAccess();
  return (
    <div className="rounded-lg border border-dashed border-line px-6 py-12 text-center">
      <p className="font-display text-base text-ink">{allowed ? "Project not found" : "Page not found"}</p>
      <p className="mx-auto mt-1 max-w-sm text-sm text-graphite">
        {allowed ? "It may have been deleted, or the link is wrong." : "There is nothing at this address."}
      </p>
      {allowed && (
        <div className="mt-4 flex justify-center">
          <Link href="/pm" className={btnSecondary}>
            Back to dashboard
          </Link>
        </div>
      )}
    </div>
  );
}
