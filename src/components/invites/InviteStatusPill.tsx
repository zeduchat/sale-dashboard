import { cx } from "@/components/zedu";
import type { InviteStatus } from "@/lib/invites";

const styles: Record<InviteStatus, { label: string; cls: string }> = {
  PENDING: { label: "Pending", cls: "bg-z-status-warning/15 text-z-fg-warning" },
  ACCEPTED: { label: "Accepted", cls: "bg-z-status-success/15 text-z-fg-success" },
  EXPIRED: { label: "Expired", cls: "bg-z-sunken text-z-fg-muted" },
  REVOKED: { label: "Revoked", cls: "bg-z-status-danger/10 text-z-fg-danger" },
};

export function InviteStatusPill({ status }: { status: InviteStatus }) {
  const s = styles[status];
  return (
    <span className={cx("inline-flex h-[22px] items-center whitespace-nowrap rounded-full px-2 text-z-caption font-medium", s.cls)}>{s.label}</span>
  );
}
