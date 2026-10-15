# Sale Dashboard

Next.js (App Router) full-stack app with Postgres (Prisma). Invite-only access: email + password (JWT access token and rotating refresh token in httpOnly cookies) or Google sign-in for existing users.

## Setup

```bash
docker compose up -d      # local Postgres on :55432 (or use your own and edit DATABASE_URL)
cp .env.example .env      # fill in the values
npm install
npx prisma migrate deploy # or `npm run db:migrate` in dev
npm run db:seed           # optional: sample leads, calls, tasks, notes and teammates (wipes those tables)
npm run dev
```

## Access and invites

There is no sign-up. Every route except `/login`, `/setup`, `/request-access` and `/api/auth/*` requires a session (`src/middleware.ts`).

1. An admin invites someone at `/invites` (emails a 9-character setup code), or a row is added to the `Invite` table by hand.
2. The invitee enters the code at `/setup`, then sets their name, email and password at `/setup/profile` and is signed in.
3. People without an invite use `/request-access`, which emails every admin and appears on `/invites`.
4. "Continue with Google" signs in the account with that email, or creates a new one with the Member role. Admins are only created through invites.

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

Set `AUTH_SECRET` (32+ random chars) and the `SMTP_*` variables from `.env.example`. Without `SMTP_HOST`, emails are printed to the server log.

## Pages

- `/` Dashboard: KPIs, recent lead activity and tasks.
- `/leads` Leads: search, filter (status, lead type, owner), sort, tabs (All / Assigned to me / Unassigned),
  bulk assign / change status / delete, and Add lead (with duplicate-phone detection). `?new=1` opens Add lead.
- `/leads/[id]` Lead profile: details, owner, next action, and Activity / Calls / Tasks / Notes, with
  Edit details, Log call and New task.

Owners are team members (any user who has signed in; the seed adds three sample teammates). Each lead gets an
`LD-####` code, numbered from 1001.

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
