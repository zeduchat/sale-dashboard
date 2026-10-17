import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { getDashboardData } from "@/lib/dashboard";
import { parseRange } from "@/lib/range";
import { getShellCounts } from "@/lib/shell";
import { Dashboard } from "@/components/dashboard/Dashboard";
import { AppShell } from "@/components/shell/AppShell";

export const dynamic = "force-dynamic";

type Props = { searchParams: { range?: string | string[] } };

export default async function Home({ searchParams }: Props) {
  const session = await getSession();
  if (!session) redirect("/login");

  const [data, shell] = await Promise.all([getDashboardData(parseRange(searchParams.range)), getShellCounts()]);
  const name = session.user.name;

  return (
    <AppShell
      user={{ name, email: session.user.email, image: session.user.image, role: session.user.role }}
      openTaskCount={data.openTaskCount}
      unread={data.overdueCount > 0}
      accessRequestCount={shell.accessRequestCount}
    >
      <Dashboard data={data} firstName={name.split(/\s+/)[0]} />
    </AppShell>
  );
}
