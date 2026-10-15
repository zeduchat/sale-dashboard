"use client";

import { MailPlus } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Button, Card, PageHeader } from "@/components/zedu";
import { apiFetch } from "@/lib/auth/client";
import type { AccessRequestDTO, InviteDTO } from "@/lib/invites";
import { AccessRequestsCard } from "./AccessRequestsCard";
import { InviteModal } from "./InviteModal";
import { InviteTable } from "./InviteTable";

async function getJson<T>(url: string): Promise<T> {
  const res = await apiFetch(url);
  if (!res.ok) throw new Error(res.status === 403 ? "Only admins can manage invites." : "Couldn't load data. Try again.");
  return res.json();
}

/** Self-contained invite management screen. Renders inside whatever shell wraps it. */
export function InvitesPage() {
  const [invites, setInvites] = useState<InviteDTO[] | null>(null);
  const [requests, setRequests] = useState<AccessRequestDTO[]>([]);
  const [loadError, setLoadError] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [prefill, setPrefill] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    try {
      const [i, r] = await Promise.all([getJson<InviteDTO[]>("/api/invites"), getJson<AccessRequestDTO[]>("/api/access-requests")]);
      setInvites(i);
      setRequests(r);
    } catch (e) {
      setLoadError((e as Error).message);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  function openModal(email = "") {
    setPrefill(email);
    setModalOpen(true);
  }

  async function act(id: string, run: () => Promise<Response>, ok: string) {
    setBusyId(id);
    setNotice("");
    try {
      const res = await run();
      if (!res.ok) setNotice((await res.json().catch(() => ({}))).error ?? "That didn't work. Try again.");
      else setNotice(ok);
      await load();
    } finally {
      setBusyId(null);
    }
  }

  const resend = (i: InviteDTO) =>
    act(i.id, () => apiFetch(`/api/invites/${i.id}/resend`, { method: "POST" }), `Invite re-sent to ${i.email}.`);
  const revoke = (i: InviteDTO) => act(i.id, () => apiFetch(`/api/invites/${i.id}`, { method: "DELETE" }), "Invite revoked.");
  const dismiss = (r: AccessRequestDTO) => act(r.id, () => apiFetch(`/api/access-requests/${r.id}`, { method: "DELETE" }), "Request dismissed.");

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-5 pb-10">
      <PageHeader
        className="!px-0"
        title="Invites"
        count={invites?.length}
        description="Invite your team to the Zedu Sales Dashboard."
        actions={
          <Button icon={<MailPlus aria-hidden />} onClick={() => openModal()}>
            Invite people
          </Button>
        }
      />

      {notice && (
        <p role="status" className="rounded-z-md bg-z-sunken px-3 py-2 text-z-small text-z-fg-secondary">
          {notice}
        </p>
      )}

      <AccessRequestsCard requests={requests} onInvite={(r) => openModal(r.email)} onDismiss={dismiss} />

      <Card bleed>
        {loadError ? (
          <p role="alert" className="p-6 text-z-small text-z-fg-danger">
            {loadError}
          </p>
        ) : invites === null ? (
          <p className="p-6 text-z-small text-z-fg-muted">Loading…</p>
        ) : invites.length === 0 ? (
          <div className="flex flex-col items-center gap-3 p-10 text-center">
            <p className="text-z-body font-medium text-z-fg">No invites yet</p>
            <p className="text-z-small text-z-fg-muted">Invite your first teammate to get started.</p>
            <Button variant="secondary" onClick={() => openModal()}>
              Invite people
            </Button>
          </div>
        ) : (
          <InviteTable invites={invites} busyId={busyId} onResend={resend} onRevoke={revoke} />
        )}
      </Card>

      <InviteModal open={modalOpen} onClose={() => setModalOpen(false)} onCreated={() => load()} initialEmail={prefill} />
    </div>
  );
}
