"use client";

import { SquareCheck } from "lucide-react";
import { useEffect, useState, useTransition } from "react";
import { toggleTask } from "@/app/actions";
import type { TaskGroup, TaskRow } from "@/lib/dashboard";
import { Card, Checkbox, CountBadge, buttonClass, cx } from "@/components/zedu";
import { EmptyPanel } from "./EmptyPanel";

const GROUPS: { key: TaskGroup; label: string }[] = [
  { key: "overdue", label: "Overdue" },
  { key: "today", label: "Today" },
  { key: "upcoming", label: "Upcoming" },
];

/** "Tasks · overdue, today, upcoming", with optimistic tick-off. */
export function TasksCard({ tasks: initial }: { tasks: TaskRow[] }) {
  const [tasks, setTasks] = useState(initial);
  const [, startTransition] = useTransition();

  // Pick up fresh server data after revalidation.
  useEffect(() => setTasks(initial), [initial]);

  function toggle(id: string, done: boolean) {
    const set = (value: boolean) => setTasks((ts) => ts.map((t) => (t.id === id ? { ...t, done: value } : t)));
    set(done);
    startTransition(async () => {
      try {
        await toggleTask(id, done);
      } catch {
        set(!done);
      }
    });
  }

  return (
    <Card
      title="Tasks · overdue, today, upcoming"
      icon={<SquareCheck aria-hidden />}
      action={
        <a href="/tasks" className={buttonClass({ variant: "secondary", size: "sm" })}>
          See all tasks
        </a>
      }
      className="min-h-[360px]"
    >
      {tasks.length === 0 ? (
        <EmptyPanel title="You're all caught up" body="Nothing overdue or due in the next 7 days." />
      ) : (
        <div className="flex flex-col gap-4">
          {GROUPS.map(({ key, label }) => {
            const rows = tasks.filter((t) => t.group === key);
            if (!rows.length) return null;
            const open = rows.filter((t) => !t.done).length;
            return (
              <section key={key} aria-label={label} className="flex flex-col">
                <h4 className="flex h-6 items-center gap-2 z-overline text-z-fg-muted">
                  {label}
                  <CountBadge count={open} tone={key === "overdue" && open > 0 ? "danger" : "neutral"} />
                </h4>
                <ul className="flex flex-col">
                  {rows.map((t) => (
                    <li key={t.id} className="flex items-start gap-3 border-b border-z-line py-2.5 last:border-b-0">
                      <Checkbox
                        label={t.title}
                        hideLabel
                        checked={t.done}
                        onChange={(e) => toggle(t.id, e.target.checked)}
                        className="mt-0.5"
                      />
                      <div className="flex min-w-0 flex-1 flex-col">
                        <p className={cx("truncate text-z-small font-medium", t.done ? "text-z-fg-muted line-through" : "text-z-fg")}>
                          {t.title}
                        </p>
                        {t.subtitle && <p className="truncate text-z-caption text-z-fg-muted">{t.subtitle}</p>}
                      </div>
                      <span
                        className={cx(
                          "shrink-0 text-z-caption",
                          key === "overdue" && !t.done ? "font-medium text-z-fg-danger" : "text-z-fg-muted",
                        )}
                      >
                        {t.when}
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}
        </div>
      )}
    </Card>
  );
}
