"use client";

import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { Check, ChevronLeft, Download, Upload, X } from "lucide-react";
import { Button, Card, IconButton } from "@/components/zedu";
import {
  contactErrorCsv,
  downloadCsv,
  parseContactCsv,
} from "@/lib/contact-import-csv";
import {
  MAX_IMPORT_BYTES,
  importReport,
  reviewImport,
  type ImportReport,
  type ImportRow,
} from "@/schemas/contact-import";

import { ContactImportTable } from "./ContactImportTable";

type Props = {
  onClose: () => void;
  onImported?: () => void;
  standalone?: boolean;
};
type Step = "upload" | "review" | "confirm" | "results";
const SAMPLE =
  "Name,Phone,Email,Company\r\nExample contact,08030000000,contact@example.com,Example company\r\n";

async function requestImport(
  mode: "preview" | "commit",
  rows: ImportRow[],
): Promise<ImportReport> {
  const response = await fetch("/api/contacts/import", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ mode, rows }),
    signal: AbortSignal.timeout(mode === "commit" ? 90000 : 30000),
  });
  const data = await response.json().catch(() => null);
  if (!response.ok || !data?.rows || !data?.counts)
    throw new Error(
      data?.error ||
        "Could not process the import. Check your connection and review again before retrying.",
    );
  return data as ImportReport;
}

export default function ContactImport({
  onClose,
  onImported,
  standalone = false,
}: Props) {
  const dialog = useRef<HTMLDialogElement>(null);
  const busyRef = useRef(false);
  const [step, setStep] = useState<Step>("upload");
  const [report, setReport] = useState<ImportReport | null>(null);
  const [fileName, setFileName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [needsCheck, setNeedsCheck] = useState(false);

  useEffect(() => {
    if (standalone) return;
    const previous = document.activeElement as HTMLElement | null;
    dialog.current?.showModal();
    return () => {
      previous?.focus();
    };
  }, [standalone]);

  useEffect(() => {
    const preventExit = (event: BeforeUnloadEvent) => {
      if (busyRef.current) {
        event.preventDefault();
        event.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", preventExit);
    return () => window.removeEventListener("beforeunload", preventExit);
  }, []);

  function startWork() {
    if (busyRef.current) return false;
    busyRef.current = true;
    setBusy(true);
    setError("");
    return true;
  }
  function finishWork() {
    busyRef.current = false;
    setBusy(false);
  }

  async function upload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || !startWork()) return;
    setReport(null);
    setFileName("");
    try {
      if (!file.name.toLowerCase().endsWith(".csv"))
        throw new Error("Choose a .csv file.");
      if (file.size > MAX_IMPORT_BYTES)
        throw new Error("Choose a CSV file no larger than 2 MB.");
      const rows = parseContactCsv(await file.text());
      setReport(importReport(reviewImport(rows)));
      setFileName(file.name);
      setStep("review");
      setNeedsCheck(true);
      setReport(await requestImport("preview", rows));
      setNeedsCheck(false);
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Could not read this file.",
      );
    } finally {
      finishWork();
    }
  }

  function update(rowNumber: number, patch: Partial<ImportRow>) {
    if (!report || busyRef.current) return;
    setReport(
      importReport(
        reviewImport(
          report.rows.map((row) =>
            row.row === rowNumber ? { ...row, ...patch } : row,
          ),
        ),
      ),
    );
    setNeedsCheck(true);
    setError("");
  }

  async function confirm() {
    if (!report || !startWork()) return;
    try {
      const checked = await requestImport("preview", report.rows);
      setReport(checked);
      setNeedsCheck(false);
      if (!checked.counts.ready) {
        setError(
          "No contacts are ready. Correct or exclude affected records, or choose another file.",
        );
        return;
      }
      setStep("confirm");
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Could not check contacts.",
      );
    } finally {
      finishWork();
    }
  }

  async function save() {
    if (!report || !startWork()) return;
    try {
      const result = await requestImport("commit", report.rows);
      setReport(result);
      setStep("results");
      if (result.counts.imported) onImported?.();
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Import failed. Review again before retrying.",
      );
      setStep("review");
      setNeedsCheck(true);
    } finally {
      finishWork();
    }
  }

  const counts = report?.counts;
  const issueCount = counts
    ? counts.invalid + counts.duplicate + counts.failed
    : 0;
  const close = () => {
    if (!busyRef.current) onClose();
  };

  const content = (
    <div className="zedu flex min-h-0 flex-col text-z-fg" aria-busy={busy}>
      <header className="flex items-start gap-4 border-b border-z-line p-5 sm:p-6">
        <div className="min-w-0 flex-1">
          <h1 id="csv-import-title" className="text-z-section">
            Import contacts
          </h1>
          <p className="mt-1 text-z-small text-z-fg-muted">
            Upload a CSV, review the records, then confirm what to save.
          </p>
        </div>
        <IconButton label="Close import" disabled={busy} onClick={close}>
          <X aria-hidden />
        </IconButton>
      </header>
      <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-5 sm:p-6">
        <ol
          aria-label="Import progress"
          className="flex flex-wrap gap-x-6 gap-y-2 text-z-small"
        >
          {(["upload", "review", "confirm", "results"] as const).map(
            (item, index) => (
              <li
                key={item}
                aria-current={step === item ? "step" : undefined}
                className={
                  step === item
                    ? "font-medium text-z-fg-accent"
                    : "text-z-fg-muted"
                }
              >
                {index + 1}. {item[0].toUpperCase() + item.slice(1)}
              </li>
            ),
          )}
        </ol>
        {error && (
          <p
            role="alert"
            className="rounded-z-md border border-z-line-danger bg-z-danger-subtle p-3 text-z-small text-z-fg-danger"
          >
            {error}
          </p>
        )}
        {busy && (
          <p role="status" className="text-z-small text-z-fg-muted">
            {step === "confirm"
              ? "Saving contacts. Keep this window open…"
              : "Checking contacts…"}
          </p>
        )}
        {step === "upload" && (
          <Card title="Upload CSV" icon={<Upload aria-hidden />}>
            <p className="text-z-small text-z-fg-secondary">
              Name and Phone are required. Email and Company are optional.
              Maximum 2 MB and 1,000 records. Other columns are ignored.
            </p>
            <div className="rounded-z-lg border border-dashed border-z-line-strong bg-z-subtle p-5">
              <label
                htmlFor="contact-csv"
                className="block text-z-small font-medium"
              >
                Choose a CSV file
              </label>
              <input
                id="contact-csv"
                type="file"
                accept=".csv,text/csv"
                disabled={busy}
                onChange={upload}
                className="z-focus mt-3 block w-full rounded-z-sm text-z-small file:mr-3 file:rounded-z-md file:border file:border-z-line-strong file:bg-z-surface file:px-3 file:py-2 file:text-z-small"
              />
            </div>
            <div>
              <Button
                variant="secondary"
                icon={<Download aria-hidden />}
                onClick={() =>
                  downloadCsv(SAMPLE, "contact-import-template.csv")
                }
              >
                Download template
              </Button>
            </div>
          </Card>
        )}
        {report && counts && step !== "upload" && (
          <>
            <p className="break-all text-z-small text-z-fg-muted">
              {fileName} · {report.rows.length} records
            </p>
            <div
              role="status"
              aria-live="polite"
              className="grid grid-cols-2 gap-3 sm:grid-cols-4"
            >
              <Summary
                label={step === "results" ? "Imported" : "Ready"}
                count={step === "results" ? counts.imported : counts.ready}
              />
              <Summary
                label="Invalid / failed"
                count={counts.invalid + counts.failed}
              />
              <Summary label="Duplicates skipped" count={counts.duplicate} />
              <Summary label="Excluded" count={counts.excluded} />
            </div>
            {step === "confirm" && (
              <Card title="Confirm import">
                <p className="text-z-small text-z-fg-secondary">
                  Save {counts.ready} contacts? Invalid, duplicate and excluded
                  records will be skipped. Stored duplicates are checked again
                  when saving. This creates contacts only.
                </p>
              </Card>
            )}
            {step === "results" && (
              <Card title="Import complete" icon={<Check aria-hidden />}>
                <p className="text-z-small text-z-fg-secondary">
                  {counts.imported} contacts saved. {issueCount} records need
                  attention; {counts.excluded} excluded.
                  {issueCount > 0 &&
                    " Download the error report to correct and upload those records again."}{" "}
                  No leads were created.
                </p>
              </Card>
            )}
            {needsCheck && (
              <p className="text-z-small text-z-fg-muted">
                Changes need another check against stored contacts. Select
                Review import to check them.
              </p>
            )}
            <ContactImportTable
              key={step}
              report={report}
              editable={step === "review"}
              isResults={step === "results"}
              busy={busy}
              needsCheck={needsCheck}
              update={update}
            />
          </>
        )}
      </div>
      <footer className="flex flex-wrap items-center justify-end gap-2 border-t border-z-line bg-z-subtle p-4 sm:px-6">
        {report && issueCount > 0 && (
          <Button
            variant="secondary"
            disabled={busy}
            icon={<Download aria-hidden />}
            onClick={() =>
              downloadCsv(
                contactErrorCsv(report.rows),
                "contact-import-errors.csv",
              )
            }
          >
            Download errors
          </Button>
        )}
        {step === "review" && (
          <>
            <Button
              variant="ghost"
              disabled={busy}
              icon={<ChevronLeft aria-hidden />}
              onClick={() => {
                setStep("upload");
                setReport(null);
                setError("");
              }}
            >
              Choose another file
            </Button>
            <Button disabled={busy} onClick={confirm}>
              Review import
            </Button>
          </>
        )}
        {step === "confirm" && (
          <>
            <Button
              variant="secondary"
              disabled={busy}
              onClick={() => setStep("review")}
            >
              Back to review
            </Button>
            <Button disabled={busy} onClick={save}>
              Confirm import
            </Button>
          </>
        )}
        {step === "results" && (
          <>
            <Button
              variant="secondary"
              onClick={() => {
                setStep("upload");
                setReport(null);
                setError("");
              }}
            >
              Import another file
            </Button>
            <Button onClick={close}>Done</Button>
          </>
        )}
        {step === "upload" && (
          <Button variant="secondary" disabled={busy} onClick={close}>
            Cancel
          </Button>
        )}
      </footer>
    </div>
  );

  if (standalone)
    return (
      <section className="mx-auto max-w-7xl p-4 sm:p-6">
        <div className="overflow-hidden rounded-z-xl border border-z-line bg-z-surface">
          {content}
        </div>
      </section>
    );
  return (
    <dialog
      ref={dialog}
      aria-labelledby="csv-import-title"
      onCancel={(event) => {
        event.preventDefault();
        close();
      }}
      onClose={close}
      className="m-auto max-h-[calc(100dvh-32px)] w-[calc(100%-32px)] max-w-6xl overflow-hidden rounded-z-xl border-0 bg-z-surface p-0 shadow-z-lg backdrop:bg-z-inverse/40 [&>div]:max-h-[calc(100dvh-32px)]"
    >
      {content}
    </dialog>
  );
}

function Summary({ label, count }: { label: string; count: number }) {
  return (
    <div className="rounded-z-lg border border-z-line bg-z-surface p-4">
      <p className="text-z-caption text-z-fg-muted">{label}</p>
      <p className="mt-1 text-z-section">{count}</p>
    </div>
  );
}
