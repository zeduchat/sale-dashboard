import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { AppShell } from "@/components/shell/AppShell";
import { TasksBoard } from "@/components/tasks/TasksBoard";
import { INITIAL_TASKS } from "@/data/tasks";

export const dynamic = "force-dynamic";

export const metadata = { title: "Tasks" };

export default async function TasksPage() {
  const session = await getSession();
  if (!session) redirect("/login?next=/tasks");

  const name = session.user.name;
  const open = INITIAL_TASKS.filter((t) => t.status !== "Completed").length;
  const overdue = INITIAL_TASKS.some((t) => t.dueTone === "overdue" && t.status !== "Completed");

  return (
    <AppShell
      user={{ name, email: session.user.email, image: session.user.image }}
      openTaskCount={open}
      unread={overdue}
      active="Tasks"
    >
      <TasksBoard />
    </AppShell>
  );
}
