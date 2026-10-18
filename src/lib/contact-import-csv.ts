import Papa from "papaparse";
import {
  MAX_IMPORT_BYTES,
  MAX_IMPORT_ROWS,
  type ImportRow,
  type ReviewedRow,
} from "@/schemas/contact-import";

/** Record numbers include the header; embedded newlines do not create extra records. */
export function parseContactCsv(text: string): ImportRow[] {
  if (new TextEncoder().encode(text).length > MAX_IMPORT_BYTES)
    throw new Error("Choose a CSV file no larger than 2 MB.");
  const parsed = Papa.parse<string[]>(text.replace(/^\uFEFF/, ""), {
    skipEmptyLines: "greedy",
  });
  if (parsed.errors.length)
    throw new Error(`Unable to read CSV: ${parsed.errors[0].message}`);
  const [header, ...records] = parsed.data;
  if (!header) throw new Error("The CSV file is empty.");
  const fields = header.map((field) => field.trim().toLowerCase());
  if (!fields.includes("name") || !fields.includes("phone"))
    throw new Error(
      "Include Name and Phone columns. Email and Company are optional.",
    );
  if (fields.some((field) => !field) || new Set(fields).size !== fields.length)
    throw new Error("Column names must be unique and cannot be empty.");
  if (!records.length) throw new Error("The CSV contains no contact records.");
  if (records.length > MAX_IMPORT_ROWS)
    throw new Error(
      `Use no more than ${MAX_IMPORT_ROWS} contact rows per file.`,
    );
  return records.map((record, index) => {
    if (record.length !== fields.length)
      throw new Error(
        `Record ${index + 2} has ${record.length} values; expected ${fields.length}. Check commas and quotes.`,
      );
    const get = (field: string) => record[fields.indexOf(field)]?.trim() ?? "";
    return {
      row: index + 2,
      name: get("name"),
      phone: get("phone"),
      email: get("email"),
      company: get("company"),
      excluded: false,
    };
  });
}

export function contactErrorCsv(rows: ReviewedRow[]) {
  return (
    "\uFEFF" +
    Papa.unparse(
      rows
        .filter((row) =>
          ["invalid", "duplicate", "failed"].includes(row.status),
        )
        .map((row) => ({
          Name: row.name,
          Phone: row.phone,
          Email: row.email,
          Company: row.company,
          Record: row.row,
          Error: row.error,
        })),
      { escapeFormulae: true },
    )
  );
}

export function downloadCsv(csv: string, name: string) {
  const url = URL.createObjectURL(
    new Blob([csv], { type: "text/csv;charset=utf-8" }),
  );
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
