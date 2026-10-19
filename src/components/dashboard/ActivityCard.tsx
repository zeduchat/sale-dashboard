import { PhoneCall } from "lucide-react";
import type { ActivityItem } from "@/lib/dashboard";
import { STAGES } from "@/lib/status";
import { Avatar, Card, StatusPill } from "@/components/zedu";
import { EmptyPanel } from "./EmptyPanel";

const initialsOf = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join("");

/** "Recent lead activity": latest calls and new leads, newest first. */
export function ActivityCard({ items }: { items: ActivityItem[] }) {
  return (
    <Card
      title="Recent lead activity"
      icon={<PhoneCall aria-hidden />}
      className="min-h-[360px]"
    >
      {items.length === 0 ? (
        <EmptyPanel title="No activity yet" body="Calls and new leads will show up here." />
      ) : (
        <ul className="-my-1 flex flex-col">
          {items.map((a) => (
            <li key={a.id} className="flex items-center gap-3 border-b border-z-line py-3 last:border-b-0">
              <Avatar initials={initialsOf(a.name)} />
              <div className="flex min-w-0 flex-1 flex-col">
                <p className="truncate text-z-small font-medium text-z-fg">{a.name}</p>
                <p className="truncate text-z-caption text-z-fg-muted">{a.detail}</p>
              </div>
              {a.status && <StatusPill stage={STAGES[a.status].stage} label={STAGES[a.status].label} className="max-sm:hidden" />}
              <time dateTime={a.at} className="w-[120px] shrink-0 text-right text-z-caption text-z-fg-muted max-sm:w-auto">
                {a.when}
              </time>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
