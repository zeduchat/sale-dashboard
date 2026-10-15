import { redirect } from "next/navigation";
import { InvitesPage } from "@/components/invites/InvitesPage";
import { getSession } from "@/lib/auth";

export const metadata = { title: "Invites" };
export const dynamic = "force-dynamic";

export default async function Page() {
  const session = await getSession();
  if (!session) redirect("/login?next=/invites");
  if (session.user.role !== "ADMIN") redirect("/");

  return (
    <div className="zedu min-h-screen bg-z-app px-6 py-8 max-sm:px-4">
      <InvitesPage />
    </div>
  );
}
