import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/shell/AppShell";
import { SettingsView } from "@/components/settings/SettingsView";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getShellCounts } from "@/lib/shell";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Settings · Zedu Sales" };

export default async function SettingsPage() {
  const session = await getSession();
  if (!session) redirect("/login?next=/settings");

  const [shell, userRecord] = await Promise.all([
    getShellCounts(),
    prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        createdAt: true,
      },
    }),
  ]);

  if (!userRecord) redirect("/login");

  const name = userRecord.name ?? userRecord.email ?? "User";
  const user = {
    id: userRecord.id,
    name,
    email: userRecord.email,
    role: userRecord.role,
    createdAt: userRecord.createdAt.toISOString(),
  };

  return (
    <AppShell
      user={{ name: user.name, email: user.email, image: null, role: user.role }}
      {...shell}
    >
      <SettingsView user={user} />
    </AppShell>
  );
}
