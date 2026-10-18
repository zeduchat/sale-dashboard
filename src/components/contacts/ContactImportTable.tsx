"use client";
import { useState } from "react";
import {
  Button,
  Card,
  Input,
  Table,
  TableCell,
  TableHead,
  TableRow,
} from "@/components/zedu";
import {
  IMPORT_FIELDS,
  type ImportField,
  type ImportReport,
  type ImportRow,
  type ImportStatus,
} from "@/schemas/contact-import";
const LABELS: Record<ImportField, string> = {
  name: "Name",
  phone: "Phone",
  email: "Email",
  company: "Company",
};
const STATUS: Record<ImportStatus, string> = {
  ready: "Ready",
  invalid: "Invalid",
  duplicate: "Duplicate",
  excluded: "Excluded",
  imported: "Imported",
  failed: "Failed",
};

const PAGE_SIZE = 20;
type Props = {
  report: ImportReport;
  editable: boolean;
  isResults: boolean;
  busy: boolean;
  needsCheck: boolean;
  update: (row: number, patch: Partial<ImportRow>) => void;
};
export function ContactImportTable({
  report,
  editable,
  isResults,
  busy,
  needsCheck,
  update,
}: Props) {
  const [page, setPage] = useState(0);
  const [issuesOnly, setIssuesOnly] = useState(false);
  const filtered = report.rows.filter(
    (row) =>
      !issuesOnly || ["invalid", "duplicate", "failed"].includes(row.status),
  );
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount - 1);
  const visibleRows = filtered.slice(
    currentPage * PAGE_SIZE,
    (currentPage + 1) * PAGE_SIZE,
  );
  return (
    <Card bleed>
      <div className="flex flex-wrap items-center justify-between gap-3 p-4">
        <h2 className="text-z-card">
          {isResults ? "Record results" : "Review contacts"}
        </h2>
        <label className="flex items-center gap-2 text-z-small">
          <input
            type="checkbox"
            checked={issuesOnly}
            disabled={busy}
            onChange={(event) => {
              setIssuesOnly(event.target.checked);
              setPage(0);
            }}
            className="accent-z-accent"
          />
          Show issues only
        </label>
      </div>
      <Table>
        <thead>
          <tr>
            <TableHead>Record</TableHead>
            {IMPORT_FIELDS.map((field) => (
              <TableHead key={field}>{LABELS[field]}</TableHead>
            ))}
            <TableHead>Status</TableHead>
            {editable && <TableHead>Action</TableHead>}
          </tr>
        </thead>
        <tbody>
          {visibleRows.map((row) => (
            <TableRow
              key={row.row}
              className={row.excluded ? "opacity-50" : undefined}
            >
              <TableCell>{row.row}</TableCell>
              {IMPORT_FIELDS.map((field) => (
                <TableCell key={field}>
                  {editable ? (
                    <Input
                      aria-label={`${LABELS[field]} for record ${row.row}`}
                      value={row[field]}
                      disabled={busy || row.excluded}
                      onChange={(event) =>
                        update(row.row, { [field]: event.target.value })
                      }
                      className={field === "email" ? "min-w-52" : "min-w-40"}
                    />
                  ) : (
                    <span
                      className="block max-w-52 truncate"
                      title={row[field]}
                    >
                      {row[field] || "—"}
                    </span>
                  )}
                </TableCell>
              ))}
              <TableCell>
                <span
                  className={
                    row.status === "invalid" || row.status === "failed"
                      ? "text-z-fg-danger"
                      : row.status === "duplicate"
                        ? "text-z-fg-warning"
                        : row.status === "imported"
                          ? "text-z-fg-success"
                          : "text-z-fg-secondary"
                  }
                >
                  {needsCheck && row.status === "ready"
                    ? "Ready to check"
                    : STATUS[row.status]}
                </span>
                {row.error && (
                  <p className="mt-1 max-w-64 whitespace-normal text-z-caption text-z-fg-muted">
                    {row.error}
                  </p>
                )}
              </TableCell>
              {editable && (
                <TableCell>
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={busy}
                    aria-label={`${row.excluded ? "Include" : "Exclude"} record ${row.row}`}
                    onClick={() => update(row.row, { excluded: !row.excluded })}
                  >
                    {row.excluded ? "Include" : "Exclude"}
                  </Button>
                </TableCell>
              )}
            </TableRow>
          ))}
        </tbody>
      </Table>
      {!filtered.length && (
        <p className="p-5 text-center text-z-small text-z-fg-muted">
          No records to show.
        </p>
      )}
      <div className="flex items-center justify-between gap-3 border-t border-z-line p-3 text-z-small text-z-fg-muted">
        <span>
          Page {currentPage + 1} of {pageCount}
        </span>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="secondary"
            disabled={busy || currentPage === 0}
            onClick={() => setPage(currentPage - 1)}
          >
            Previous
          </Button>
          <Button
            size="sm"
            variant="secondary"
            disabled={busy || currentPage + 1 >= pageCount}
            onClick={() => setPage(currentPage + 1)}
          >
            Next
          </Button>
        </div>
      </div>
    </Card>
  );
}
