import { phoneKey, validateLead } from "@/lib/leadForm";

export const MAX_IMPORT_BYTES = 2 * 1024 * 1024;
export const MAX_IMPORT_ROWS = 1000;
export const MAX_IMPORT_REQUEST_BYTES = 4 * 1024 * 1024;
export const IMPORT_FIELDS = ["name", "phone", "email", "company"] as const;
export type ImportField = (typeof IMPORT_FIELDS)[number];
export type ContactImportRow = Record<ImportField, string>;
export type ImportRow = ContactImportRow & { row: number; excluded: boolean };
export type ImportStatus =
  "ready" | "invalid" | "duplicate" | "excluded" | "imported" | "failed";
export type ReviewedRow = ImportRow & {
  status: ImportStatus;
  error: string;
  contactId?: string;
};
export type ImportReport = {
  rows: ReviewedRow[];
  counts: Record<ImportStatus, number>;
};
export type ContactImportValidation =
  { valid: true; value: ContactImportRow } | { valid: false; error: string };

/** Matches the contacts directory's local Nigerian/international phone policy. */
export const importPhoneKey = phoneKey;

export function validateContactImportRow(
  input: unknown,
): ContactImportValidation {
  if (!input || typeof input !== "object" || Array.isArray(input))
    return { valid: false, error: "Invalid contact data." };
  const source = input as Record<string, unknown>;
  const value = Object.fromEntries(
    IMPORT_FIELDS.map((field) => [
      field,
      typeof source[field] === "string" ? source[field].trim() : "",
    ]),
  ) as ContactImportRow;
  const error = Object.values(validateLead(value, "contact"))[0];
  if (error) return { valid: false, error };
  if (value.phone.length > 40)
    return { valid: false, error: "Phone must not exceed 40 characters." };
  if (value.email.length > 200)
    return { valid: false, error: "Email must not exceed 200 characters." };
  return { valid: true, value };
}

/** Validate request shape before accessing contact data or beginning a transaction. */
export function readImportRows(input: unknown): ImportRow[] {
  if (!Array.isArray(input) || !input.length || input.length > MAX_IMPORT_ROWS)
    throw new Error(`Provide between 1 and ${MAX_IMPORT_ROWS} contact rows.`);
  const ids = new Set<number>();
  return input.map((entry) => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry))
      throw new Error("Invalid contact row.");
    const item = entry as Record<string, unknown>;
    if (
      !Number.isSafeInteger(item.row) ||
      (item.row as number) < 2 ||
      ids.has(item.row as number)
    )
      throw new Error(
        "Each contact must have a unique CSV record number, starting at 2.",
      );
    ids.add(item.row as number);
    if (
      typeof item.excluded !== "boolean" ||
      IMPORT_FIELDS.some((field) => typeof item[field] !== "string")
    )
      throw new Error(
        "Contact fields must be text and excluded must be a boolean.",
      );
    if (IMPORT_FIELDS.some((field) => (item[field] as string).length > 10000))
      throw new Error(
        "A contact field exceeds the 10,000 character input limit.",
      );
    return {
      row: item.row as number,
      excluded: item.excluded,
      ...Object.fromEntries(IMPORT_FIELDS.map((field) => [field, item[field]])),
    } as ImportRow;
  });
}

export type ExistingContact = {
  id: string;
  phone: string;
  email: string | null;
};

export function reviewImport(
  rows: ImportRow[],
  existing: ExistingContact[] = [],
): ReviewedRow[] {
  const phones = new Map(
    existing.map((contact) => [importPhoneKey(contact.phone), contact.id]),
  );
  const emails = new Map(
    existing
      .filter((contact) => contact.email)
      .map((contact) => [contact.email!.trim().toLowerCase(), contact.id]),
  );
  const csvPhones = new Set<string>();
  const csvEmails = new Set<string>();
  return rows.map((row): ReviewedRow => {
    const base = { ...row, error: "" };
    if (row.excluded) return { ...base, status: "excluded" };
    const validation = validateContactImportRow(row);
    if (!validation.valid)
      return { ...base, status: "invalid", error: validation.error };
    const value = { ...base, ...validation.value };
    const phone = importPhoneKey(value.phone);
    const email = value.email.toLowerCase();
    const existingId =
      phones.get(phone) || (email ? emails.get(email) : undefined);
    if (existingId)
      return {
        ...value,
        status: "duplicate",
        contactId: existingId,
        error: "A stored contact has this phone number or email.",
      };
    if (csvPhones.has(phone) || (email && csvEmails.has(email)))
      return {
        ...value,
        status: "duplicate",
        error:
          "An earlier included, valid record has this phone number or email.",
      };
    csvPhones.add(phone);
    if (email) csvEmails.add(email);
    return { ...value, status: "ready" };
  });
}

export function importReport(rows: ReviewedRow[]): ImportReport {
  const counts = {
    ready: 0,
    invalid: 0,
    duplicate: 0,
    excluded: 0,
    imported: 0,
    failed: 0,
  };
  for (const row of rows) counts[row.status]++;
  return { rows, counts };
}
