"use client";

import { Check, Copy, Mail } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { FormError } from "@/components/auth/FormError";
import { useAuthRequest } from "@/components/auth/useAuthRequest";
import { Modal } from "@/components/ui/Modal";
import { Button, Input, cx } from "@/components/zedu";
import { normalizeEmail } from "@/lib/auth/validation";
import type { InviteDTO } from "@/lib/invites";

type Role = InviteDTO["role"];
const ROLES: { value: Role; label: string }[] = [
  { value: "MEMBER", label: "Member" },
  { value: "ADMIN", label: "Admin" },
];

type Created = { invite: InviteDTO; emailSent: boolean };

type Props = {
  open: boolean;
  onClose: () => void;
  onCreated: (invite: InviteDTO) => void;
  /** Pre-fills the email, e.g. from an access request. */
  initialEmail?: string;
};

export function InviteModal({ open, onClose, onCreated, initialEmail = "" }: Props) {
  const { pending, error, setError, submit } = useAuthRequest<Created>("/api/invites");
  const [email, setEmail] = useState(initialEmail);
  const [role, setRole] = useState<Role>("MEMBER");
  const [created, setCreated] = useState<Created | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (open) {
      setEmail(initialEmail);
      setRole("MEMBER");
      setCreated(null);
      setCopied(false);
      setError(null);
    }
  }, [open, initialEmail, setError]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const res = await submit({ email, role });
    if (res) {
      setCreated(res);
      onCreated(res.invite);
    }
  }

  async function copy() {
    if (!created?.invite.token) return;
    try {
      await navigator.clipboard.writeText(created.invite.token);
      setCopied(true);
    } catch {}
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={created ? "Invite created" : "Invite someone"}
      description={created ? undefined : "They'll get an email with a one-time setup code that expires in 7 days."}
    >
      {created ? (
        <div className="flex flex-col gap-4">
          <p className="text-z-small text-z-fg-secondary">
            {created.emailSent
              ? `We emailed ${created.invite.email}. You can also share the code yourself:`
              : `We couldn't send the email to ${created.invite.email}. Share this code with them directly:`}
          </p>
          <div className="flex items-center justify-between gap-3 rounded-z-md bg-z-sunken px-4 py-3">
            <span className="font-mono text-z-section tracking-[0.2em] text-z-fg">{created.invite.token}</span>
            <Button variant="secondary" size="sm" icon={copied ? <Check aria-hidden /> : <Copy aria-hidden />} onClick={copy}>
              {copied ? "Copied" : "Copy"}
            </Button>
          </div>
          <div className="flex justify-end">
            <Button onClick={onClose}>Done</Button>
          </div>
        </div>
      ) : (
        <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
          <FormError message={error} />
          <Input
            label="Email"
            type="email"
            icon={<Mail aria-hidden />}
            placeholder="name@company.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoFocus
            required
          />
          <div className="flex flex-col gap-1.5">
            <span className="text-z-caption font-medium text-z-fg-secondary">Role</span>
            <div role="radiogroup" aria-label="Role" className="grid grid-cols-2 gap-2">
              {ROLES.map((r) => (
                <button
                  key={r.value}
                  type="button"
                  role="radio"
                  aria-checked={role === r.value}
                  onClick={() => setRole(r.value)}
                  className={cx(
                    "z-focus h-9 rounded-z-md border text-z-body transition-colors duration-150",
                    role === r.value
                      ? "border-z-line-strong bg-z-surface font-medium text-z-fg shadow-z-xs"
                      : "border-transparent bg-z-sunken text-z-fg-muted hover:text-z-fg-secondary",
                  )}
                >
                  {r.label}
                </button>
              ))}
            </div>
            {role === "ADMIN" && <span className="text-z-caption text-z-fg-muted">Admins can invite people and receive access requests.</span>}
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending || !normalizeEmail(email)}>
              {pending ? "Sending…" : "Send invite"}
            </Button>
          </div>
        </form>
      )}
    </Modal>
  );
}
