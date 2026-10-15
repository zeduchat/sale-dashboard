"use server";

import { ActivityType, CallOutcome, LeadStatus, LeadType, LostReason, TaskType, type Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/auth";
import { phoneDigits, validateLead, type LeadFormErrors, type LeadFormValues } from "@/lib/leadForm";
import { prisma } from "@/lib/prisma";
import { STAGES, leadCode } from "@/lib/status";

async function requireUser() {
  const session = await getSession();
  if (!session) throw new Error("Unauthorized");
  return { id: session.user.id, name: session.user.name || session.user.email };
}

function refresh() {
  // Leads show up on the dashboard, the list and the profile, so refresh them all.
  revalidatePath("/", "layout");
}

const isStatus = (s: string): s is LeadStatus => s in LeadStatus;
const clean = (s: string | undefined) => (s ?? "").trim();

export type Duplicate = { id: string; code: string; name: string; owner: string | null };

/** Leads that already use this phone number (compared on the last 10 digits, whatever the formatting). */
async function findDuplicates(phone: string, excludeId?: string): Promise<Duplicate[]> {
  const digits = phoneDigits(phone).slice(-10);
  if (digits.length < 7) return [];
  const rows = await prisma.$queryRaw<{ id: string; code: number; name: string; owner: string | null }[]>`
    SELECT l."id", l."code", l."name", COALESCE(u."name", u."email") AS owner
    FROM "Lead" l LEFT JOIN "User" u ON u."id" = l."ownerId"
    WHERE regexp_replace(l."phone", '[^0-9]', '', 'g') LIKE ${"%" + digits}
      AND (${excludeId ?? ""} = '' OR l."id" <> ${excludeId ?? ""})
    ORDER BY l."createdAt" ASC
    LIMIT 3`;
  return rows.map((r) => ({ id: r.id, code: leadCode(r.code), name: r.name, owner: r.owner }));
}

/** Called when the phone field loses focus in Add lead. */
export async function checkDuplicatePhone(phone: string): Promise<Duplicate | null> {
  await requireUser();
  return (await findDuplicates(phone))[0] ?? null;
}

export type CreateLeadResult =
  | { ok: true; id: string; code: string }
  | { ok: false; errors: LeadFormErrors; duplicate?: undefined }
  | { ok: false; errors?: undefined; duplicate: Duplicate };

export async function createLead(values: LeadFormValues, opts: { allowDuplicate?: boolean } = {}): Promise<CreateLeadResult> {
  const me = await requireUser();
  const errors = validateLead(values);
  if (Object.keys(errors).length) return { ok: false, errors };

  if (!opts.allowDuplicate) {
    const [duplicate] = await findDuplicates(values.phone);
    if (duplicate) return { ok: false, duplicate };
  }

  const status = isStatus(values.status) ? values.status : LeadStatus.NEW;
  const owner = values.ownerId ? await prisma.user.findUnique({ where: { id: values.ownerId }, select: { id: true, name: true, email: true } }) : null;
  const ownerLabel = owner ? owner.name ?? owner.email ?? "Unnamed" : "Unassigned";
  const followUp = values.followUp ? new Date(`${values.followUp}T09:00:00`) : null;
  const notes = clean(values.notes);

  const lead = await prisma.$transaction(async (tx) => {
    const lead = await tx.lead.create({
      data: {
        name: clean(values.name),
        phone: clean(values.phone),
        email: clean(values.email) || null,
        company: clean(values.company) || null,
        type: values.type === "BUSINESS" ? LeadType.BUSINESS : LeadType.INDIVIDUAL,
        status,
        lostReason: status === LeadStatus.LOST ? LostReason.OTHER : null,
        ownerId: owner?.id ?? null,
        ownerName: owner ? ownerLabel : "",
        createdById: me.id,
        activities: { create: { type: ActivityType.CREATED, actorId: me.id, toStatus: status, detail: `Added manually · Owner: ${ownerLabel}` } },
      },
    });
    if (notes) {
      const note = await tx.note.create({ data: { leadId: lead.id, authorId: me.id, body: notes } });
      await tx.activity.create({ data: { leadId: lead.id, actorId: me.id, type: ActivityType.NOTE_ADDED, noteId: note.id } });
    }
    if (followUp) {
      const task = await tx.task.create({
        data: { title: "Follow up", type: TaskType.FOLLOW_UP, dueAt: followUp, leadId: lead.id, userId: owner?.id ?? me.id },
      });
      await tx.activity.create({ data: { leadId: lead.id, actorId: me.id, type: ActivityType.TASK_CREATED, taskId: task.id } });
    }
    return lead;
  });

  refresh();
  return { ok: true, id: lead.id, code: leadCode(lead.code) };
}

export type UpdateLeadResult = { ok: true } | { ok: false; errors: LeadFormErrors };

export async function updateLead(id: string, values: LeadFormValues): Promise<UpdateLeadResult> {
  const me = await requireUser();
  const errors = validateLead(values);
  if (Object.keys(errors).length) return { ok: false, errors };

  const before = await prisma.lead.findUniqueOrThrow({ where: { id } });
  const status = isStatus(values.status) ? values.status : before.status;
  const ownerId = values.ownerId || null;
  const owner = ownerId ? await prisma.user.findUnique({ where: { id: ownerId }, select: { name: true, email: true } }) : null;

  const data = {
    name: clean(values.name),
    phone: clean(values.phone),
    email: clean(values.email) || null,
    company: clean(values.company) || null,
    type: values.type === "BUSINESS" ? LeadType.BUSINESS : LeadType.INDIVIDUAL,
  };
  const detailsChanged = (Object.keys(data) as (keyof typeof data)[]).some((k) => data[k] !== before[k]);

  await prisma.$transaction([
    prisma.lead.update({
      where: { id },
      data: {
        ...data,
        status,
        lostReason: status === LeadStatus.LOST ? before.lostReason ?? LostReason.OTHER : null,
        ownerId,
        ownerName: owner ? owner.name ?? owner.email ?? "" : "",
      },
    }),
    ...(detailsChanged ? [prisma.activity.create({ data: { leadId: id, actorId: me.id, type: ActivityType.DETAILS_UPDATED } })] : []),
    ...(status !== before.status
      ? [prisma.activity.create({ data: { leadId: id, actorId: me.id, type: ActivityType.STATUS_CHANGED, fromStatus: before.status, toStatus: status } })]
      : []),
    ...(ownerId !== before.ownerId
      ? [prisma.activity.create({ data: { leadId: id, actorId: me.id, type: ActivityType.OWNER_CHANGED, detail: owner ? `Owner: ${owner.name ?? owner.email}` : "Owner removed" } })]
      : []),
  ]);
  refresh();
  return { ok: true };
}

/** Status for one or more leads. LOST records a reason (defaults to Other). */
export async function setLeadStatus(ids: string[], status: string, lostReason?: string) {
  const me = await requireUser();
  if (!isStatus(status) || !ids.length) return;
  const reason = status === LeadStatus.LOST ? (lostReason && lostReason in LostReason ? (lostReason as LostReason) : LostReason.OTHER) : null;
  const leads = await prisma.lead.findMany({ where: { id: { in: ids } }, select: { id: true, status: true } });
  const changed = leads.filter((l) => l.status !== status);
  await prisma.$transaction([
    prisma.lead.updateMany({ where: { id: { in: ids } }, data: { status, lostReason: reason } }),
    prisma.activity.createMany({
      data: changed.map((l) => ({ leadId: l.id, actorId: me.id, type: ActivityType.STATUS_CHANGED, fromStatus: l.status, toStatus: status })),
    }),
  ]);
  refresh();
}

/** Owner for one or more leads; null removes the owner. */
export async function assignLeads(ids: string[], ownerId: string | null) {
  const me = await requireUser();
  if (!ids.length) return;
  const owner = ownerId ? await prisma.user.findUnique({ where: { id: ownerId }, select: { id: true, name: true, email: true } }) : null;
  if (ownerId && !owner) throw new Error("Unknown team member");
  const label = owner ? owner.name ?? owner.email ?? "" : "";
  const leads = await prisma.lead.findMany({ where: { id: { in: ids } }, select: { id: true, ownerId: true } });
  const changed = leads.filter((l) => l.ownerId !== (owner?.id ?? null));
  await prisma.$transaction([
    prisma.lead.updateMany({ where: { id: { in: ids } }, data: { ownerId: owner?.id ?? null, ownerName: label } }),
    prisma.activity.createMany({
      data: changed.map((l) => ({ leadId: l.id, actorId: me.id, type: ActivityType.OWNER_CHANGED, detail: owner ? `Owner: ${label}` : "Owner removed" })),
    }),
  ]);
  refresh();
}

export async function deleteLeads(ids: string[]) {
  await requireUser();
  if (!ids.length) return;
  await prisma.lead.deleteMany({ where: { id: { in: ids } } });
  refresh();
}

export async function addNote(leadId: string, body: string) {
  const me = await requireUser();
  const text = body.trim();
  if (!text) return;
  await prisma.$transaction(async (tx) => {
    const note = await tx.note.create({ data: { leadId, authorId: me.id, body: text.slice(0, 5000) } });
    await tx.activity.create({ data: { leadId, actorId: me.id, type: ActivityType.NOTE_ADDED, noteId: note.id } });
  });
  refresh();
}

export type TaskInput = { title: string; type: string; due: string; ownerId: string };

export async function createTask(leadId: string, input: TaskInput): Promise<{ ok: true } | { ok: false; error: string }> {
  const me = await requireUser();
  const title = input.title.trim();
  if (!title) return { ok: false, error: "Enter what needs doing." };
  const dueAt = new Date(input.due);
  if (!input.due || Number.isNaN(dueAt.getTime())) return { ok: false, error: "Pick a due date and time." };
  const type = input.type in TaskType ? (input.type as TaskType) : TaskType.OTHER;
  await prisma.$transaction(async (tx) => {
    const task = await tx.task.create({ data: { title: title.slice(0, 200), type, dueAt, leadId, userId: input.ownerId || me.id } });
    await tx.activity.create({ data: { leadId, actorId: me.id, type: ActivityType.TASK_CREATED, taskId: task.id } });
  });
  refresh();
  return { ok: true };
}

export type CallInput = { outcome: string; minutes: string; notes: string; status: string; followUp: string };

/** Logs a call, updates the lead's last interaction, and optionally moves the status and adds a follow-up task. */
export async function logCall(leadId: string, input: CallInput): Promise<{ ok: true } | { ok: false; error: string }> {
  const me = await requireUser();
  if (!(input.outcome in CallOutcome)) return { ok: false, error: "Pick how the call went." };
  const minutes = input.minutes ? Number(input.minutes) : null;
  if (minutes !== null && (!Number.isFinite(minutes) || minutes < 0 || minutes > 600)) return { ok: false, error: "Enter the duration in minutes (0–600)." };
  const lead = await prisma.lead.findUniqueOrThrow({ where: { id: leadId }, select: { status: true, ownerId: true } });
  const status = isStatus(input.status) ? input.status : lead.status;
  const followUp = input.followUp ? new Date(input.followUp) : null;

  await prisma.$transaction(async (tx) => {
    const now = new Date();
    const call = await tx.call.create({
      data: {
        leadId,
        outcome: input.outcome as CallOutcome,
        durationSec: minutes === null ? null : Math.round(minutes * 60),
        notes: input.notes.trim().slice(0, 5000) || null,
        userId: me.id,
        calledAt: now,
      },
    });
    const ops: Prisma.ActivityCreateManyInput[] = [{ leadId, actorId: me.id, type: ActivityType.CALL_LOGGED, callId: call.id, createdAt: now }];
    if (status !== lead.status) {
      ops.push({ leadId, actorId: me.id, type: ActivityType.STATUS_CHANGED, fromStatus: lead.status, toStatus: status, createdAt: new Date(now.getTime() + 1) });
    }
    await tx.lead.update({
      where: { id: leadId },
      data: { lastInteractionAt: now, status, lostReason: status === LeadStatus.LOST ? LostReason.NOT_INTERESTED : null },
    });
    if (followUp && !Number.isNaN(followUp.getTime())) {
      const task = await tx.task.create({
        data: { title: `Follow up: ${STAGES[status].label}`, type: TaskType.FOLLOW_UP, dueAt: followUp, leadId, userId: lead.ownerId ?? me.id, callId: call.id },
      });
      ops.push({ leadId, actorId: me.id, type: ActivityType.TASK_CREATED, taskId: task.id, createdAt: new Date(now.getTime() + 2) });
    }
    await tx.activity.createMany({ data: ops });
  });
  refresh();
  return { ok: true };
}
