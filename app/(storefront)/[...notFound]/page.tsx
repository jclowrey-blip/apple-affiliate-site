import { notFound } from "next/navigation";

// With the storefront in a route group, unmatched URLs would otherwise fall
// through to a bare 404 with no header or footer. This catch-all keeps them
// rendering inside the storefront layout, as they did before the move.
export default function CatchAllNotFound() {
  notFound();
}
