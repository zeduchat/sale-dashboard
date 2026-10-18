import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { getShellCounts } from "@/lib/shell";
import { AppShell } from "@/components/shell/AppShell";
import { ContactImportScreen } from "@/components/contacts/ContactImportScreen";

export const metadata = { title: "Import contacts" };
export const dynamic = "force-dynamic";

export default async function ContactImportPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  const shell = await getShellCounts();
  return (
    <AppShell user={session.user} {...shell} active="Contacts">
      <ContactImportScreen />
    </AppShell>
  );
}
