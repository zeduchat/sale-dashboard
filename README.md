# Sale Dashboard

Next.js (App Router) full-stack app with Postgres (Prisma). Invite-only access: email + password (JWT access token and rotating refresh token in httpOnly cookies) or Google sign-in for existing users.

## Setup

```bash
docker compose up -d      # local Postgres on :55432 (or use your own and edit DATABASE_URL)
cp .env.example .env      # fill in the values
npm install
npx prisma migrate deploy # or `npm run db:migrate` in dev
npm run db:seed           # optional: sample contacts, leads, calls, tasks, notes and teammates (wipes those tables)
npm run dev
```

## Access and invites

There is no sign-up. Every route except `/login`, `/setup`, `/request-access` and `/api/auth/*` requires a session (`src/middleware.ts`).

1. An admin invites someone at `/invites` (emails a 9-character setup code), or a row is added to the `Invite` table by hand.
2. The invitee enters the code at `/setup`, then sets their name, email and password at `/setup/profile` and is signed in.
3. People without an invite use `/request-access`, which emails every admin and appears on `/invites`.
4. "Continue with Google" signs in the account with that email, or creates a new one with the Member role. New admins come from invites.

### Roles

Migration `0008_everyone_admin` made every existing account an Admin. Admins downgrade people to Member (or
deactivate them) in Settings › Team & Access; the change applies on the next page load, because the role is read
from the database on each request rather than trusted from the access token. Admins see an **Admin** section in
the sidebar (Team & invitations, with a badge for pending access requests, and Settings); Members don't, and
can't open `/invites` or the team APIs.

Create the first admin by inserting an invite with the `ADMIN` role, then open `/setup`:

```sql
INSERT INTO "Invite" (token, role) VALUES ('ABCDEFGHJ', 'ADMIN');
```

### Master key

A bootstrap/admin key for setup and recovery, sent as `x-master-key: <key>` (or `Authorization: Bearer <key>`):

```bash
# Create an admin invite (role defaults to ADMIN; optional email, maxUses 1-10), then open /setup with the code
curl -X POST $APP_URL/api/admin/bootstrap -H "x-master-key: $KEY" -H "Content-Type: application/json" -d '{}'
```

Setting and rotating the key has its own endpoint under `src/app/api/admin/`: `PUT` with an optional `{"newKey": "..."}`
(32+ chars; omit it to get a generated key, shown once; only a hash is stored). The first call, while no key is stored,
needs no credentials and claims the key; after that it needs the current key or a signed-in admin session. Until a key is
stored, the optional `MASTER_KEY` env value is also accepted by `bootstrap`; once one is stored the env value stops working.

Set `AUTH_SECRET` (32+ random chars; falls back to `NEXTAUTH_SECRET` if unset) and the `SMTP_*` variables from `.env.example`. Without `SMTP_HOST`, emails are printed to the server log.

## Pages

- Top bar (every page): global search (⌘K or `/`) across leads, contacts, tasks and teammates, including phone
  numbers in any format and LD/CT codes; "New" opens Add lead, New task and Add contact from anywhere.
- `/` Dashboard: KPIs, recent lead activity and tasks.
- `/leads` Leads: search, filter (status, lead type, owner), sort, tabs (All / Assigned to me / Unassigned),
  bulk assign / change status / delete, and Add lead (with duplicate-phone detection). `?new=1` opens Add lead.
- `/leads/[id]` Lead profile: details, owner, next action, and Activity / Calls / Tasks / Notes, with
  Edit details, Log call and New task.
- `/contacts` Contacts: search (phone numbers match in any format, matches in bold), filter (company, linked
  lead, created), sort, tabs (All / Individuals / Businesses / Possible duplicates), and Add contact (with the
  duplicate-phone warning and "Also create a lead"). `?new=1` opens Add contact.
- Possible duplicates: pairs with the same phone number, the same email, or the same name at the same company.
  "Not a duplicate" hides a pair for everyone; "Review and merge" picks each field's value and folds one record
  into the other (its leads, calls, tasks, notes and timeline move across; old links open the survivor).
- `/contacts/[id]` Contact profile: details, linked records (leads and company), next action, Activity / Calls /
  Tasks / Notes, Edit details, Log call, New task, and Create lead (new, or link an existing lead).

Owners are team members (any user who has signed in; the seed adds three sample teammates). Each lead gets an
`LD-####` code, numbered from 1001; each contact a `CT-####` code.

### Contacts and leads

A contact is one person or business. Every lead points to a contact and reads its name, phone, email, company
and type from it, so editing the contact updates its leads (nothing is copied). Calls, tasks, notes and timeline
entries link to the contact and, when there is one, the lead. Phone numbers are also stored in +234 form
(`phoneKey`), so `0803 123 4567` and `+234 803 123 4567` count as the same number for search and duplicates.
Migration `0007_contacts` upgrades the contacts directory table from `0003_contacts` in place: contacts already
linked to a lead keep that link (now `Lead.contactId`), every other lead gets its own contact, and unlinked
contacts stay. The leads' old name/phone/email/company/type columns are kept but no longer used.

## Design system

ZEDU v2 components and tokens live in `src/components/zedu` (see its [README](src/components/zedu/README.md)).
Browse them at `/design-system` while running `npm run dev`.

## Deploy (Coolify)

- Build pack: Dockerfile. The container runs `prisma migrate deploy` on start.
- Set the variables from `.env.example` in Coolify.
- GitHub secrets: `COOLIFY_WEBHOOK_URL` (and optionally `COOLIFY_TOKEN`). The
  `Deploy (Coolify)` workflow only runs after `Malware Scan (CI Gate)` passes on `main`.

## Live

https://sale.zedu.chat
