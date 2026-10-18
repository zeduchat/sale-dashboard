import assert from "node:assert/strict";
import { test } from "node:test";
import {
  contactErrorCsv,
  parseContactCsv,
} from "../src/lib/contact-import-csv";
import {
  importReport,
  readImportRows,
  reviewImport,
  validateContactImportRow,
  type ImportRow,
} from "../src/schemas/contact-import";
import { phoneKey } from "../src/lib/leadForm";

const row = (patch: Partial<ImportRow> = {}): ImportRow => ({
  row: 2,
  name: "Example",
  phone: "08030000000",
  email: "",
  company: "",
  excluded: false,
  ...patch,
});

test("CSV accepts BOM, trimmed/reordered headers, quoted commas and embedded newlines", () => {
  const rows = parseContactCsv(
    '\uFEFF Phone ,NAME,Company,Email\r\n08030000000,"Example, One","Two\nlines",one@example.com\r\n',
  );
  assert.equal(rows[0].name, "Example, One");
  assert.equal(rows[0].company, "Two\nlines");
  assert.equal(rows[0].row, 2);
});

test("CSV rejects missing/duplicate/empty headers, uneven rows and broken quoting", () => {
  for (const csv of [
    "Email\nx@y.com",
    "Name,Phone,name\na,08030000000,b",
    "Name,Phone,\na,b,c",
    'Name,Phone\n"unfinished,08030000000',
    "Name,Phone\na,08030000000,extra",
    "Name,Phone\na",
  ]) {
    assert.throws(() => parseContactCsv(csv));
  }
});

test("empty files, header-only files, too many rows and oversized files are rejected", () => {
  for (const csv of [
    "",
    "Name,Phone\n",
    "Name,Phone\n" + "Example,08030000000\n".repeat(1001),
    "x".repeat(2 * 1024 * 1024 + 1),
  ])
    assert.throws(() => parseContactCsv(csv));
});

test("field validation matches contacts constraints and trims values", () => {
  assert.deepEqual(validateContactImportRow(row({ name: " Example " })), {
    valid: true,
    value: { name: "Example", phone: "08030000000", email: "", company: "" },
  });
  for (const patch of [
    { name: "" },
    { name: "x".repeat(121) },
    { company: "x".repeat(121) },
    { phone: "1".repeat(16) },
    { phone: "0803abc0000000" },
    { email: "name@example.c" },
    { phone: "123" },
    { email: "bad" },
    { company: "x".repeat(201) },
    { name: "x".repeat(201) },
    { phone: "1".repeat(41) },
    { email: "x".repeat(195) + "@ex.com" },
  ])
    assert.equal(validateContactImportRow(row(patch)).valid, false);
  assert.equal(validateContactImportRow(row({ name: "x".repeat(120), company: "x".repeat(120) })).valid, true);
});

test("local and international Nigerian phone numbers use directory matching", () => {
  const rows = reviewImport([
    row(),
    row({ row: 3, phone: "+234 803 000 0000" }),
  ]);
  assert.equal(rows[1].status, "duplicate");
  assert.equal(phoneKey(rows[0].phone), phoneKey(rows[1].phone));
});

test("email duplicates are case insensitive and stored duplicates are shown before saving", () => {
  const reviewed = reviewImport([
    row({ email: "TEST@example.com" }),
    row({ row: 3, phone: "08030000001", email: "test@EXAMPLE.com" }),
  ]);
  assert.equal(reviewed[1].status, "duplicate");
  assert.equal(
    reviewImport(
      [row()],
      [{ id: "stored", phone: "+2348030000000", email: null }],
    )[0].contactId,
    "stored",
  );
  assert.equal(
    reviewImport(
      [row({ email: "Test@example.com" })],
      [{ id: "stored", phone: "08039999999", email: "test@example.com" }],
    )[0].status,
    "duplicate",
  );
});

test("excluded and invalid rows do not block a valid later contact", () => {
  assert.equal(
    reviewImport([row({ excluded: true }), row({ row: 3 })])[1].status,
    "ready",
  );
  assert.equal(
    reviewImport([row({ name: "" }), row({ row: 3 })])[1].status,
    "ready",
  );
  const edited = [row({ phone: "08039999999" }), row({ row: 3 })];
  assert.equal(reviewImport(edited)[1].status, "ready");
});

test("request shape rejects forged types, duplicate record numbers and excess rows", () => {
  for (const value of [
    null,
    [],
    [row({ row: 1 })],
    [row(), row()],
    [{ ...row(), excluded: "false" }],
    [{ ...row(), phone: 8030000000 }],
    [row({ company: "x".repeat(10001) })],
    Array.from({ length: 1001 }, (_, i) => row({ row: i + 2 })),
  ])
    assert.throws(() => readImportRows(value));
  assert.equal(readImportRows([{ ...row(), status: "imported" }])[0].row, 2);
});

test("report counts partition every input row, including exclusions", () => {
  const report = importReport(
    reviewImport([
      row(),
      row({ row: 3 }),
      row({ row: 4, name: "" }),
      row({ row: 5, excluded: true }),
    ]),
  );
  assert.deepEqual(report.counts, {
    ready: 1,
    invalid: 1,
    duplicate: 1,
    excluded: 1,
    imported: 0,
    failed: 0,
  });
  assert.equal(
    Object.values(report.counts).reduce((sum, count) => sum + count, 0),
    report.rows.length,
  );
});

test("error downloads retain supported fields, protect formulas, and can be reuploaded", () => {
  const csv = contactErrorCsv(
    reviewImport([row({ name: "=1+1", email: "invalid", company: "Example" })]),
  );
  assert.match(csv, /'=1\+1/);
  const uploaded = parseContactCsv(csv);
  assert.equal(uploaded[0].name, "'=1+1");
  assert.equal(uploaded[0].company, "Example");
  assert.equal(uploaded[0].email, "invalid");
});
