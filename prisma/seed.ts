import {
  ActivityType,
  CallOutcome,
  LeadStatus,
  LeadType,
  LostReason,
  PrismaClient,
  TaskType,
  type User,
} from "@prisma/client";

const prisma = new PrismaClient();

// Deterministic PRNG so re-seeding gives the same numbers.
let state = 42;
const rand = () => ((state = (state * 1664525 + 1013904223) % 2 ** 32) / 2 ** 32);
const pick = <T>(xs: readonly T[]) => xs[Math.floor(rand() * xs.length)];

/** Date `daysAgo` days before today at the given local time. */
function at(daysAgo: number, h = 9, m = 0) {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  d.setHours(h, m, 0, 0);
  return d;
}

// Sample rows from the original mock: [daysAgo, made, connected, unanswered].
const recentDays: [number, number, number, number][] = [
  [6, 44, 29, 15], [5, 44, 26, 18], [4, 52, 32, 20], [3, 50, 32, 18],
  [2, 44, 29, 15], [1, 44, 26, 18], [0, 44, 29, 15],
];

const firstNames = ["Chidi", "Ngozi", "Femi", "Bola", "Ifeoma", "Segun", "Zainab", "Emeka", "Yemi", "Halima", "Obinna", "Funke"];
const lastNames = ["Okeke", "Balogun", "Adeyemi", "Musa", "Eze", "Ogunleye", "Nwosu", "Bello", "Afolabi", "Danjuma"];
const companySuffix = ["Ltd", "Ventures", "Global", "Enterprises", "Hub", "Logistics"];
// Weighted towards the early pipeline, roughly 12% won.
const fillerStatuses: LeadStatus[] = [
  "NEW", "NEW", "CONTACTED", "CONTACTED", "CONNECTED", "INTERESTED", "INTERESTED",
  "FOLLOW_UP", "FOLLOW_UP", "QUALIFIED", "PROPOSAL", "WON", "WON", "LOST", "LOST", "LOST",
];

const phone = () =>
  `+234 80${Math.floor(rand() * 10)} ${String(Math.floor(rand() * 1000)).padStart(3, "0")} ${String(Math.floor(rand() * 10000)).padStart(4, "0")}`;

/** Same rule as phoneKey() in src/lib/leadForm.ts. */
function phoneKey(p: string) {
  const d = p.replace(/\D/g, "");
  return d.length === 11 && d.startsWith("0") ? `234${d.slice(1)}` : d;
}

type ContactSeed = {
  name: string;
  phone: string;
  email: string | null;
  company: string | null;
  type: LeadType;
  createdById: string;
  createdAt: Date;
  notes?: string;
};

function contactData(c: ContactSeed) {
  return {
    ...c,
    phoneKey: phoneKey(c.phone),
    activities: { create: { type: ActivityType.CONTACT_CREATED, actorId: c.createdById, detail: "Added manually", createdAt: c.createdAt } },
  };
}

async function teamMember(name: string, email: string) {
  // Everyone is an Admin until someone downgrades them (see migration 0008_everyone_admin).
  return prisma.user.upsert({ where: { email }, update: {}, create: { name, email, role: "ADMIN" } });
}

async function main() {
  await prisma.activity.deleteMany();
  await prisma.note.deleteMany();
  await prisma.task.deleteMany();
  await prisma.call.deleteMany();
  await prisma.lead.deleteMany();
  await prisma.contact.deleteMany();
  await prisma.duplicateDismissal.deleteMany();

  // Sample teammates. The first real signed-in user (if any) also gets a share of the leads,
  // so "Assigned to me" has something in it.
  const agnes = await teamMember("Agnes Okafor", "agnes@zedu.example");
  const ibrahim = await teamMember("Ibrahim Musa", "ibrahim@zedu.example");
  const zainab = await teamMember("Zainab Bello", "zainab@zedu.example");
  const me = await prisma.user.findFirst({ where: { accounts: { some: {} } } });
  const team: User[] = me ? [me, agnes, ibrahim, zainab] : [agnes, ibrahim, zainab];
  const owner = () => (rand() < 0.12 ? null : pick(team));

  // Background leads spread over the last ~45 days (gives the KPIs a previous period).
  for (let i = 0; i < 60; i++) {
    const business = rand() < 0.35;
    const first = pick(firstNames);
    const last = pick(lastNames);
    const status = pick(fillerStatuses);
    const company = business ? `${last} ${pick(companySuffix)}` : null;
    const o = owner();
    const createdAt = at(7 + Math.floor(rand() * 38), 8 + Math.floor(rand() * 9));
    const createdById = pick(team).id;
    const contact = await prisma.contact.create({
      data: contactData({
        name: `${first} ${last}`,
        phone: phone(),
        email: rand() < 0.6 ? `${first}.${last}@${(company ?? "mail").toLowerCase().replace(/\s+/g, "")}.ng`.toLowerCase() : null,
        company,
        type: business ? LeadType.BUSINESS : LeadType.INDIVIDUAL,
        createdById,
        createdAt,
      }),
    });
    await prisma.lead.create({
      data: {
        contactId: contact.id,
        status,
        lostReason: status === LeadStatus.LOST ? pick(Object.values(LostReason)) : null,
        ownerId: o?.id ?? null,
        ownerName: o?.name ?? "",
        createdById,
        createdAt,
        activities: {
          create: { type: ActivityType.CREATED, actorId: createdById, toStatus: status, detail: `Added manually · Owner: ${o?.name ?? "Unassigned"}`, createdAt },
        },
      },
    });
  }
  const fillerIds = (await prisma.lead.findMany({ select: { id: true } })).map((l) => l.id);

  // The leads from the Figma frames, created through the same paths the app uses.
  const named = [
    { name: "Amaka Obi", phone: "+234 803 123 4568", email: "amaka@lagoonfoods.ng", company: "Lagoon Foods", type: LeadType.BUSINESS, status: LeadStatus.INTERESTED, owner: agnes, created: 6 },
    { name: "Tunde Adebayo", phone: "+234 803 123 4567", email: "tunde.adebayo@flourish.co", company: "Flourish Ltd", type: LeadType.INDIVIDUAL, status: LeadStatus.INTERESTED, owner: ibrahim, created: 5 },
    { name: "Tunde Bakare", phone: "+234 802 555 0198", email: "tunde@bakarelogistics.com", company: "Bakare Logistics", type: LeadType.BUSINESS, status: LeadStatus.FOLLOW_UP, owner: agnes, created: 9 },
    { name: "Chiamaka Eze", phone: "+234 809 771 2203", email: null, company: null, type: LeadType.INDIVIDUAL, status: LeadStatus.NEW, owner: null, created: 0 },
    { name: "Femi Adeyemi", phone: "+234 816 330 9120", email: "femi@brightpathschools.ng", company: "Brightpath Schools", type: LeadType.BUSINESS, status: LeadStatus.CONTACTED, owner: ibrahim, created: 4 },
    { name: "Ngozi Nwosu", phone: "+234 701 448 2017", email: "ngozi@nwosupharma.ng", company: "Nwosu Pharmacy", type: LeadType.BUSINESS, status: LeadStatus.WON, owner: agnes, created: 12 },
    { name: "Kunle Ajayi", phone: "+234 805 902 6611", email: null, company: null, type: LeadType.INDIVIDUAL, status: LeadStatus.LOST, owner: ibrahim, created: 10 },
    { name: "Halima Sani", phone: "+234 813 220 4471", email: "halima@sanitextiles.com", company: "Sani Textiles", type: LeadType.BUSINESS, status: LeadStatus.INTERESTED, owner: zainab, created: 3 },
    { name: "Emeka Okoro", phone: "+234 806 117 3390", email: null, company: null, type: LeadType.INDIVIDUAL, status: LeadStatus.NEW, owner: zainab, created: 1 },
  ];
  for (const n of named) {
    const createdAt = at(n.created, 9);
    const createdById = (n.owner ?? agnes).id;
    const contact = await prisma.contact.create({
      data: contactData({ name: n.name, phone: n.phone, email: n.email, company: n.company, type: n.type, createdById, createdAt }),
    });
    await prisma.lead.create({
      data: {
        contactId: contact.id,
        status: n.status,
        lostReason: n.status === LeadStatus.LOST ? LostReason.NOT_INTERESTED : null,
        ownerId: n.owner?.id ?? null,
        ownerName: n.owner?.name ?? "",
        createdById,
        createdAt,
        activities: {
          create: { type: ActivityType.CREATED, actorId: createdById, toStatus: n.status, detail: `Added manually · Owner: ${n.owner?.name ?? "Unassigned"}`, createdAt },
        },
      },
    });
  }

  // Amaka Obi gets the full profile from the "Lead profile" frames.
  const amaka = await prisma.lead.findFirstOrThrow({ where: { contact: { name: "Amaka Obi" } } });
  await prisma.contact.update({
    where: { id: amaka.contactId },
    data: { notes: "Owns three outlets (Lekki, Yaba, Ikeja). Prefers WhatsApp for documents; calls before 11 AM." },
  });
  const earlyCall = await prisma.call.create({
    data: { leadId: amaka.id, outcome: CallOutcome.CONNECTED, calledAt: at(2, 11, 20), durationSec: 180, notes: "Asked for the outlet list before quoting.", userId: agnes.id },
  });
  await prisma.task.create({
    data: { title: "Confirm outlet list with Amaka", description: "Confirm the outlet list before quoting.", type: TaskType.CALL, dueAt: at(2, 16), done: true, completedAt: at(2, 16), ownerId: agnes.id, leadId: amaka.id, userId: agnes.id, callId: earlyCall.id },
  });
  const note = await prisma.note.create({
    data: { leadId: amaka.id, authorId: ibrahim.id, body: "Spoke to her assistant, Tolu. Best time to call is mornings before 11 AM.", createdAt: at(1, 16, 5) },
  });
  const call = await prisma.call.create({
    data: { leadId: amaka.id, outcome: CallOutcome.CONNECTED, calledAt: at(0, 10, 12), durationSec: 240, notes: "Wants pricing for 3 outlets (Lekki, Yaba, Ikeja). Send proposal by Friday.", userId: agnes.id },
  });
  const task = await prisma.task.create({
    data: { title: "Send proposal to Lagoon Foods", description: "Confirm pricing for 3 outlets and send the proposal before Friday.", type: TaskType.FOLLOW_UP, dueAt: at(0, 15), ownerId: agnes.id, leadId: amaka.id, userId: agnes.id, callId: call.id, createdAt: at(0, 10, 15) },
  });
  await prisma.task.create({
    data: { title: "Book onboarding call for 3 outlets", description: "Book the onboarding call once the proposal is accepted.", type: TaskType.MEETING, dueAt: at(-4, 10), ownerId: agnes.id, leadId: amaka.id, userId: agnes.id },
  });
  await prisma.activity.createMany({
    data: [
      { leadId: amaka.id, actorId: agnes.id, type: ActivityType.CALL_LOGGED, callId: earlyCall.id, createdAt: earlyCall.calledAt },
      { leadId: amaka.id, actorId: ibrahim.id, type: ActivityType.NOTE_ADDED, noteId: note.id, createdAt: note.createdAt },
      { leadId: amaka.id, actorId: agnes.id, type: ActivityType.CALL_LOGGED, callId: call.id, createdAt: call.calledAt },
      { leadId: amaka.id, actorId: agnes.id, type: ActivityType.STATUS_CHANGED, fromStatus: LeadStatus.CONTACTED, toStatus: LeadStatus.INTERESTED, createdAt: at(0, 10, 13) },
      { leadId: amaka.id, actorId: agnes.id, type: ActivityType.TASK_CREATED, taskId: task.id, createdAt: task.createdAt },
    ],
  });

  // A few next actions on the other named leads.
  const nextActions: [string, string, TaskType, Date][] = [
    ["Tunde Bakare", "Call back", TaskType.CALL, at(1, 14)],
    ["Chiamaka Eze", "First call", TaskType.CALL, at(-2, 10)],
    ["Femi Adeyemi", "Confirm demo", TaskType.MEETING, at(0, 16)],
    ["Halima Sani", "Meeting", TaskType.MEETING, at(-4, 11)],
    ["Emeka Okoro", "First call", TaskType.CALL, at(-1, 10)],
  ];
  for (const [name, title, type, dueAt] of nextActions) {
    const lead = await prisma.lead.findFirstOrThrow({ where: { contact: { name } } });
    await prisma.task.create({ data: { title, type, dueAt, ownerId: lead.ownerId, leadId: lead.id, userId: lead.ownerId } });
  }

  // Calls: the mock's last 7 days, plus quieter background days for earlier in the month/previous period.
  const calls: { leadId: string; outcome: CallOutcome; calledAt: Date; durationSec: number | null; userId: string }[] = [];
  const addDay = (daysAgo: number, connected: number, unanswered: number) => {
    for (let i = 0; i < connected; i++) {
      const r = rand();
      const outcome = r < 0.1 ? CallOutcome.NOT_INTERESTED : r < 0.18 ? CallOutcome.OTHER : CallOutcome.CONNECTED;
      calls.push({ leadId: pick(fillerIds), outcome, calledAt: at(daysAgo, 8 + Math.floor(rand() * 9), Math.floor(rand() * 60)), durationSec: 60 + Math.floor(rand() * 600), userId: pick(team).id });
    }
    for (let i = 0; i < unanswered; i++) {
      calls.push({ leadId: pick(fillerIds), outcome: CallOutcome.NO_ANSWER, calledAt: at(daysAgo, 8 + Math.floor(rand() * 9), Math.floor(rand() * 60)), durationSec: null, userId: pick(team).id });
    }
  };
  for (const [daysAgo, , connected, unanswered] of recentDays) addDay(daysAgo, connected, unanswered);
  for (let daysAgo = 7; daysAgo < 45; daysAgo++) {
    const made = 25 + Math.floor(rand() * 20);
    const connected = Math.round(made * (0.45 + rand() * 0.15));
    addDay(daysAgo, connected, made - connected);
  }
  await prisma.call.createMany({ data: calls });

  // Named leads' last interactions from the frames.
  const interactions: [string, CallOutcome, Date][] = [
    ["Tunde Bakare", CallOutcome.NO_ANSWER, at(3, 15)],
    ["Femi Adeyemi", CallOutcome.CONNECTED, at(3, 11)],
    ["Ngozi Nwosu", CallOutcome.CONNECTED, at(5, 10)],
    ["Kunle Ajayi", CallOutcome.NOT_INTERESTED, at(7, 12)],
    ["Halima Sani", CallOutcome.CONNECTED, at(2, 14)],
  ];
  for (const [name, outcome, calledAt] of interactions) {
    const lead = await prisma.lead.findFirstOrThrow({ where: { contact: { name } } });
    const c = await prisma.call.create({ data: { leadId: lead.id, outcome, calledAt, durationSec: outcome === CallOutcome.NO_ANSWER ? null : 150, userId: lead.ownerId } });
    await prisma.activity.create({ data: { leadId: lead.id, actorId: lead.ownerId, type: ActivityType.CALL_LOGGED, callId: c.id, createdAt: calledAt } });
  }

  // Contacts from the Contacts frames: possible duplicates (same phone, same email, same name at the same
  // company) and people without a lead yet.
  const extras: (ContactSeed & { calls?: number })[] = [
    { name: "Amaka N. Obi", phone: "0803 123 4567", email: "amaka.obi@gmail.com", company: "Lagoon Foods", type: LeadType.INDIVIDUAL, createdById: zainab.id, createdAt: at(2, 14), calls: 1 },
    { name: "Tolu Bankole", phone: "+234 812 640 2290", email: "tolu@lagoonfoods.ng", company: "Lagoon Foods", type: LeadType.INDIVIDUAL, createdById: agnes.id, createdAt: at(5, 11), notes: "Amaka's assistant. Handles scheduling for the outlets." },
    { name: "Tunde B.", phone: "+234 809 334 1180", email: "tunde@bakarelogistics.com", company: null, type: LeadType.INDIVIDUAL, createdById: ibrahim.id, createdAt: at(4, 10) },
    { name: "Halima Sani", phone: "+234 703 991 0042", email: null, company: "Sani Textiles", type: LeadType.BUSINESS, createdById: zainab.id, createdAt: at(1, 13) },
    { name: "Bisi Coker", phone: "+234 802 118 7734", email: "bisi@cokerprints.ng", company: "Coker Prints", type: LeadType.BUSINESS, createdById: agnes.id, createdAt: at(8, 9) },
    { name: "Musa Garba", phone: "+234 806 552 9013", email: null, company: null, type: LeadType.INDIVIDUAL, createdById: ibrahim.id, createdAt: at(15, 15) },
  ];
  for (const { calls: n = 0, ...e } of extras) {
    const c = await prisma.contact.create({ data: contactData(e) });
    for (let i = 0; i < n; i++) {
      const call = await prisma.call.create({ data: { contactId: c.id, outcome: CallOutcome.NO_ANSWER, calledAt: at(1, 12), userId: e.createdById } });
      await prisma.activity.create({ data: { contactId: c.id, actorId: e.createdById, type: ActivityType.CALL_LOGGED, callId: call.id, createdAt: call.calledAt } });
    }
  }

  // Calls, tasks, notes and timeline entries on a lead also belong to its contact.
  for (const table of ["Call", "Task", "Note", "Activity"]) {
    await prisma.$executeRawUnsafe(
      `UPDATE "${table}" t SET "contactId" = l."contactId" FROM "Lead" l WHERE l."id" = t."leadId" AND t."contactId" IS NULL`,
    );
  }

  // Denormalised last interaction = latest call per lead and per contact.
  await prisma.$executeRaw`
    UPDATE "Lead" l SET "lastInteractionAt" = c.last
    FROM (SELECT "leadId", MAX("calledAt") AS last FROM "Call" WHERE "leadId" IS NOT NULL GROUP BY "leadId") c
    WHERE l."id" = c."leadId"`;
  await prisma.$executeRaw`
    UPDATE "Contact" ct SET "lastInteractionAt" = c.last
    FROM (SELECT "contactId", MAX("calledAt") AS last FROM "Call" WHERE "contactId" IS NOT NULL GROUP BY "contactId") c
    WHERE ct."id" = c."contactId"`;

  // Dashboard tasks that aren't tied to a lead.
  await prisma.task.createMany({
    data: [
      { title: "Send proposal to Okeke Global", subtitle: "Pricing for 20 seats", description: "Pricing for 20 seats.", type: TaskType.FOLLOW_UP, dueAt: at(1, 15, 0) },
      { title: "Update lead notes", subtitle: "Log call outcomes", description: "Log call outcomes.", type: TaskType.OTHER, dueAt: at(-1, 16, 0) },
    ],
  });

  const [contacts, leads, allCalls, tasks] = await Promise.all([prisma.contact.count(), prisma.lead.count(), prisma.call.count(), prisma.task.count()]);
  console.log(`Seeded ${contacts} contacts, ${leads} leads, ${allCalls} calls, ${tasks} tasks, ${team.length} team members.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
