"use client";

import { RotateCw, Trash2 } from "lucide-react";
import { IconButton, Table, TableCell, TableHead, TableRow } from "@/components/zedu";
import type { InviteDTO } from "@/lib/invites";
import { InviteStatusPill } from "./InviteStatusPill";

const date = (iso: string) => new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

type Props = {
  invites: InviteDTO[];
  busyId: string | null;
  onResend: (invite: InviteDTO) => void;
  onRevoke: (invite: InviteDTO) => void;
};

export function InviteTable({ invites, busyId, onResend, onRevoke }: Props) {
  return (
    <Table>
      <thead>
        <tr>
          <TableHead>Email</TableHead>
          <TableHead>Role</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Invited by</TableHead>
          <TableHead>Expires</TableHead>
          <TableHead className="w-px">
            <span className="sr-only">Actions</span>
          </TableHead>
        </tr>
      </thead>
      <tbody>
        {invites.map((i) => {
          const open = i.status === "PENDING";
          return (
            <TableRow key={i.id}>
              <TableCell type="primary">{i.email}</TableCell>
              <TableCell>{i.role === "ADMIN" ? "Admin" : "Member"}</TableCell>
              <TableCell>
                <InviteStatusPill status={i.status} />
              </TableCell>
              <TableCell>{i.invitedBy ?? "—"}</TableCell>
              <TableCell>{i.status === "ACCEPTED" ? "—" : date(i.expiresAt)}</TableCell>
              <TableCell type="actions">
                {open && (
                  <span className="inline-flex gap-1">
                    {i.email && (
                      <IconButton label="Resend email" disabled={busyId === i.id} onClick={() => onResend(i)}>
                        <RotateCw aria-hidden />
                      </IconButton>
                    )}
                    <IconButton label="Revoke invite" disabled={busyId === i.id} onClick={() => onRevoke(i)}>
                      <Trash2 aria-hidden />
                    </IconButton>
                  </span>
                )}
              </TableCell>
            </TableRow>
          );
        })}
      </tbody>
    </Table>
  );
}
