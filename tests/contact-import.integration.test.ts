import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import { PrismaClient } from "@prisma/client";
import { signAccessToken } from "../src/lib/auth/jwt";
import type { ImportReport, ImportRow } from "../src/schemas/contact-import";

// Explicit opt-in: never target a user's existing development or production database.
const base = process.env.CSV_IMPORT_TEST_URL;
const databaseUrl = process.env.CSV_IMPORT_TEST_DATABASE_URL;
test(
  "authenticated CSV import against isolated PostgreSQL",
  { skip: !base || !databaseUrl },
  async () => {
    assert.match(base!, /^http:\/\/(localhost|127\.0\.0\.1):\d+$/);
    const target = new URL(databaseUrl!);
    assert.ok(["localhost", "127.0.0.1"].includes(target.hostname));
    assert.equal(target.pathname, "/zedu_csv_import_test");
    const db = new PrismaClient({ datasources: { db: { url: databaseUrl! } } });
    const tag = randomUUID();
    const member = await db.user.create({
      data: {
        name: "CSV test member",
        email: `csv-${tag}@example.com`,
        role: "MEMBER",
      },
    });
    const admin = await db.user.create({
      data: {
        name: "CSV test admin",
        email: `csv-admin-${tag}@example.com`,
        role: "ADMIN",
      },
    });
    const tokenFor = (user: typeof member) =>
      signAccessToken({
        userId: user.id,
        email: user.email!,
        name: user.name!,
        role: user.role,
      });
    let token = await tokenFor(member);
    const row = (patch: Partial<ImportRow> = {}): ImportRow => ({
      row: 2,
      name: `CSV ${tag}`,
      phone: "08030000000",
      email: "",
      company: tag,
      excluded: false,
      ...patch,
    });
    const request = (
      body: unknown,
      cookie = token,
      extra: Record<string, string> = {},
    ) =>
      fetch(`${base}/api/contacts/import`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(cookie ? { Cookie: `zedu_at=${cookie}` } : {}),
          ...extra,
        },
        body: JSON.stringify(body),
      });
    const report = async (mode: string, rows: ImportRow[]) => {
      const response = await request({ mode, rows });
      assert.equal(response.status, 200, await response.clone().text());
      return response.json() as Promise<ImportReport>;
    };
    try {
      assert.equal(
        (await request({ mode: "preview", rows: [row()] }, "")).status,
        401,
      );
      assert.equal(
        (
          await request({ mode: "preview", rows: [row()] }, token, {
            Origin: "https://other.example",
          })
        ).status,
        403,
      );
      assert.equal(
        (await request({ mode: "invalid", rows: [row()] })).status,
        400,
      );
      assert.equal(
        (await request({ mode: "preview", rows: [row(), row()] })).status,
        400,
      );
      assert.equal(
        (
          await request({
            mode: "preview",
            rows: Array.from({ length: 1001 }, (_, i) => row({ row: i + 2 })),
          })
        ).status,
        400,
      );
      assert.equal(
        (
          await request({
            mode: "preview",
            rows: [row({ company: "x".repeat(4 * 1024 * 1024) })],
          })
        ).status,
        413,
      );
      const before = await db.contact.count();
      const leadsBefore = await db.lead.count();
      const callsBefore = await db.call.count();
      const tasksBefore = await db.task.count();
      const existing = await db.contact.create({
        data: {
          name: "Existing contact must stay unchanged",
          phone: "08030000008",
          phoneKey: "2348030000008",
          email: `existing-${tag}@example.com`,
          company: tag,
          notes: "Preserve existing contact details",
          type: "BUSINESS",
          source: "MANUAL",
        },
      });
      const storedDuplicate = await report("commit", [
        row({ name: "Replacement name", phone: "+2348030000008" }),
      ]);
      assert.equal(storedDuplicate.counts.duplicate, 1);
      assert.equal(storedDuplicate.counts.imported, 0);
      assert.deepEqual(
        await db.contact.findUniqueOrThrow({ where: { id: existing.id } }),
        existing,
      );
      const input = [
        row(),
        row({ row: 3, phone: "+2348030000000" }),
        row({ row: 4, name: "", phone: "08030000001" }),
        row({ row: 5, excluded: true, phone: "08030000002" }),
      ];
      assert.equal((await report("preview", input)).counts.ready, 1);
      assert.equal(await db.contact.count(), before + 1);
      const saved = await report("commit", input);
      assert.deepEqual(saved.counts, {
        ready: 0,
        invalid: 1,
        duplicate: 1,
        excluded: 1,
        imported: 1,
        failed: 0,
      });
      const imported = await db.contact.findUniqueOrThrow({
        where: { id: saved.rows[0].contactId },
      });
      assert.equal(imported.phoneKey, "2348030000000");
      assert.equal(imported.source, "IMPORT");
      assert.equal(imported.type, "INDIVIDUAL");
      assert.equal(imported.createdById, member.id);
      assert.equal(
        await db.activity.count({
          where: {
            contactId: imported.id,
            actorId: member.id,
            type: "CONTACT_CREATED",
          },
        }),
        1,
      );
      await db.contact.create({
        data: {
          name: "CSV merged fixture",
          phone: "08030000007",
          phoneKey: "2348030000007",
          type: "INDIVIDUAL",
          company: tag,
          mergedIntoId: imported.id,
        },
      });
      assert.equal(
        (await report("preview", [row({ phone: "08030000007" })])).counts.ready,
        1,
      );
      assert.equal(await db.lead.count(), leadsBefore);
      assert.equal((await report("commit", input)).counts.imported, 0);
      const conflict = await report("preview", [
        row({ phone: "+234 803 000 0000" }),
      ]);
      assert.equal(conflict.rows[0].status, "duplicate");
      const excluded = await report("commit", [
        row({ phone: "08030000003", excluded: true }),
        row({ row: 3, phone: "08030000003" }),
      ]);
      assert.equal(excluded.counts.imported, 1);
      const concurrent = await Promise.all([
        report("commit", [row({ phone: "08030000004" })]),
        report("commit", [row({ phone: "08030000004" })]),
      ]);
      assert.equal(
        concurrent.reduce((sum, item) => sum + item.counts.imported, 0),
        1,
      );
      assert.equal(
        concurrent.reduce((sum, item) => sum + item.counts.duplicate, 0),
        1,
      );
      // Fail one row inside PostgreSQL to exercise savepoint recovery, not a mocked store.
      await db.$executeRawUnsafe(
        `CREATE OR REPLACE FUNCTION csv_test_reject() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.name = '__csv_reject__' THEN RAISE EXCEPTION 'test rejection'; END IF; RETURN NEW; END $$`,
      );
      await db.$executeRawUnsafe(
        'CREATE TRIGGER csv_test_reject BEFORE INSERT ON "Contact" FOR EACH ROW EXECUTE FUNCTION csv_test_reject()',
      );
      const partial = await report("commit", [
        row({ name: "__csv_reject__", phone: "08030000005" }),
        row({ row: 3, phone: "08030000006" }),
      ]);
      assert.equal(partial.counts.failed, 1);
      assert.equal(partial.counts.imported, 1);
      await db.$executeRawUnsafe('DROP TRIGGER csv_test_reject ON "Contact"');
      const thousand = Array.from({ length: 1000 }, (_, i) =>
        row({ row: i + 2, phone: `0900${String(i).padStart(7, "0")}` }),
      );
      assert.equal((await report("commit", thousand)).counts.imported, 1000);
      assert.equal(await db.lead.count(), leadsBefore);
      assert.equal(await db.call.count(), callsBefore);
      assert.equal(await db.task.count(), tasksBefore);
      assert.deepEqual(
        await db.contact.findUniqueOrThrow({ where: { id: existing.id } }),
        existing,
      );
      await db.user.update({
        where: { id: member.id },
        data: { disabledAt: new Date() },
      });
      assert.equal(
        (await request({ mode: "preview", rows: [row()] })).status,
        401,
      );
      token = await tokenFor(admin);
      assert.equal((await report("preview", [row()])).counts.duplicate, 1);
      console.log(
        "PASS: auth, disabled accounts, request limits, preview, persistence, no leads, exclusions, repeats, concurrent imports, real row failure and 1,000-row commit",
      );
    } finally {
      await db.$executeRawUnsafe(
        'DROP TRIGGER IF EXISTS csv_test_reject ON "Contact"',
      );
      await db.$executeRawUnsafe("DROP FUNCTION IF EXISTS csv_test_reject()");
      await db.contact.deleteMany({ where: { company: tag } });
      await db.user.deleteMany({
        where: { id: { in: [member.id, admin.id] } },
      });
      await db.$disconnect();
    }
  },
);
