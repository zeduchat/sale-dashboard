import { randomInt } from "crypto";
import type { Invite } from "@prisma/client";

// No 0/O/1/I so tokens read cleanly in an email. Hand-inserted tokens may use any A-Z0-9.
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function generateInviteToken(length = 9) {
  let t = "";
  for (let i = 0; i < length; i++) t += ALPHABET[randomInt(ALPHABET.length)];
  return t;
}

export const INVITE_TTL_DAYS = 7;

export type InviteStatus = "PENDING" | "ACCEPTED" | "EXPIRED" | "REVOKED";

/** Shape returned by /api/invites. The code itself is only included in the response to creating an invite. */
export type InviteDTO = {
  id: string;
  email: string | null;
  role: "ADMIN" | "MEMBER";
  status: InviteStatus;
  token: string | null;
  uses: number;
  maxUses: number;
  expiresAt: string;
  createdAt: string;
  invitedBy: string | null;
};

export type AccessRequestDTO = { id: string; name: string; email: string; message: string | null; createdAt: string };

export function toInviteDTO(
  i: Invite & { invitedBy?: { name: string | null; email: string | null } | null },
  opts: { withToken?: boolean } = {},
): InviteDTO {
  const status = inviteStatus(i);
  return {
    id: i.id,
    email: i.email,
    role: i.role,
    status,
    token: opts.withToken && status === "PENDING" ? i.token : null,
    uses: i.uses,
    maxUses: i.maxUses,
    expiresAt: i.expiresAt.toISOString(),
    createdAt: i.createdAt.toISOString(),
    invitedBy: i.invitedBy ? (i.invitedBy.name ?? i.invitedBy.email) : null,
  };
}

export function inviteStatus(i: Pick<Invite, "usedAt" | "revokedAt" | "expiresAt">): InviteStatus {
  if (i.usedAt) return "ACCEPTED";
  if (i.revokedAt) return "REVOKED";
  return i.expiresAt < new Date() ? "EXPIRED" : "PENDING";
}
