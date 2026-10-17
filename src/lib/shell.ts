import { prisma } from "./prisma";

function startOfDay(d: Date, addDays = 0) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  x.setDate(x.getDate() + addDays);
  return x;
}

/** Counts the app shell shows on every page: the Tasks nav badge, the notifications dot and (admins only)
 * pending access requests on Team & invitations. */
export async function getShellCounts() {
  const now = new Date();
  const [openTaskCount, overdueCount, accessRequestCount] = await Promise.all([
    prisma.task.count({ where: { done: false, dueAt: { lt: startOfDay(now, 1) } } }),
    prisma.task.count({ where: { done: false, dueAt: { lt: startOfDay(now) } } }),
    prisma.accessRequest.count({ where: { status: "PENDING" } }),
  ]);
  return { openTaskCount, unread: overdueCount > 0, accessRequestCount };
}
