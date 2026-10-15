"use server";

import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function toggleTask(id: string, done: boolean) {
  const session = await getSession();
  if (!session) throw new Error("Unauthorized");

  await prisma.task.update({ where: { id }, data: { done, completedAt: done ? new Date() : null } });
  // Tasks show on the dashboard and on lead profiles.
  revalidatePath("/", "layout");
}
