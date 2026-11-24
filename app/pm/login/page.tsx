import { notFound, redirect } from "next/navigation";
import LoginForm from "@/components/pm/LoginForm";
import { authEnabled, hasAccess } from "@/lib/pm/access";

export const metadata = { title: "Sign in" };

// The one /pm page that must render without access. It shows nothing about
// the tool's contents, and does not exist at all when no password is set.
export default async function LoginPage() {
  if (!authEnabled()) notFound();
  if (await hasAccess()) redirect("/pm");
  return <LoginForm />;
}
