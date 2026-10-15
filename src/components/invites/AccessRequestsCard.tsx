"use client";

import { UserPlus, X } from "lucide-react";
import { Button, Card, CountBadge, IconButton } from "@/components/zedu";
import type { AccessRequestDTO } from "@/lib/invites";

type Props = {
  requests: AccessRequestDTO[];
  onInvite: (request: AccessRequestDTO) => void;
  onDismiss: (request: AccessRequestDTO) => void;
};

/** People who used /request-access and are waiting for an invite. Renders nothing when there are none. */
export function AccessRequestsCard({ requests, onInvite, onDismiss }: Props) {
  if (!requests.length) return null;
  return (
    <Card title="Access requests" action={<CountBadge count={requests.length} tone="accent" />}>
      <ul className="-my-1 flex flex-col divide-y divide-z-line">
        {requests.map((r) => (
          <li key={r.id} className="flex items-center gap-3 py-3">
            <div className="flex min-w-0 flex-1 flex-col">
              <span className="truncate text-z-body font-medium text-z-fg">
                {r.name} <span className="font-normal text-z-fg-muted">{r.email}</span>
              </span>
              {r.message && <span className="truncate text-z-small text-z-fg-muted">{r.message}</span>}
            </div>
            <Button size="sm" variant="secondary" icon={<UserPlus aria-hidden />} onClick={() => onInvite(r)}>
              Invite
            </Button>
            <IconButton label={`Dismiss request from ${r.name}`} onClick={() => onDismiss(r)}>
              <X aria-hidden />
            </IconButton>
          </li>
        ))}
      </ul>
    </Card>
  );
}
