# CSV contact import

## Purpose and use

Import **Contacts only** through **Contacts → Import CSV** or **New → Import contacts (CSV)**.
The flow is **Upload → Review/edit/exclude → Confirm → Results**. Results remain open until dismissed;
saved contacts appear in Contacts. No leads are created or existing contacts overwritten.

```csv
Name,Phone,Email,Company
Example contact,08030000000,contact@example.com,Example company
```

- Name/Phone required; Email/Company optional. Headers ignore case/outer spaces; extra columns are ignored.
- Maximum **2 MB / 1,000 records**. Reject missing, blank or duplicate headers, broken quoting and inconsistent column counts.
- Name/Company: at most 120 characters; Email: at most 200 with valid syntax. Phone: 7–15 digits, permitted phone punctuation, at most 40 characters. Validation reuses the current Contacts rules.
- Matching phone **or** email marks a duplicate. Nigerian local/international phone forms match; email matching ignores case.
- Flag duplicates within the file and against stored contacts before confirmation. Excluded/invalid rows do not block later valid rows.
- Correct the four supported fields, exclude rows, filter issues and browse 20 records per page.
- Invalid/duplicate/excluded rows are skipped. Download errors with original supported fields, record number and reason; correct and re-upload.
  Record numbers count CSV records including the header, not physical lines. Spreadsheet formula prefixes are escaped in error exports.

## Design and implementation

Uses the existing [ZEDU v2 components and tokens](../src/components/zedu/README.md),
with a native accessible dialog in Contacts and the same flow inside the app shell at `/contact-import`.

| Responsibility | Location |
| --- | --- |
| Flow and paginated review UI | `src/components/contacts/ContactImport*.tsx` |
| Shared validation/matching/results | `src/schemas/contact-import.ts` |
| CSV parsing and downloads | `src/lib/contact-import-csv.ts` |
| Database preview/commit | `src/lib/contact-import.ts` |
| Import endpoint | `src/app/api/contacts/import/route.ts` |

**API:** `POST /api/contacts/import`, JSON, using the existing session cookie.
Active **ADMIN and MEMBER** users may import, preserving existing access. Disabled/deleted users receive 401;
cross-site requests with a mismatched Origin are rejected. Maximum JSON body: 4 MB.

```json
{"mode":"preview","rows":[{"row":2,"name":"Example","phone":"08030000000","email":"","company":"","excluded":false}]}
```

Use `"mode":"commit"` to save. Both return `rows` (values, `status`, `error`, optional `contactId`)
and `counts` for `ready`, `invalid`, `duplicate`, `excluded`, `imported`, `failed`.
For the preview request above, the response is:

```json
{"rows":[{"row":2,"name":"Example","phone":"08030000000","email":"","company":"","excluded":false,"status":"ready","error":""}],"counts":{"ready":1,"invalid":0,"duplicate":0,"excluded":0,"imported":0,"failed":0}}
```

Errors: **400** malformed input, **401** unauthenticated, **403** denied/cross-site,
**413** oversized JSON, **503** processing unavailable. Per-row failures appear in a successful report.

The server revalidates at commit. A PostgreSQL transaction/advisory lock serialises CSV commits;
savepoints isolate individual row rejections. A whole-transaction failure returns no success report.
If a response is lost, review/retry: committed matches will be identified as duplicates.
Client submissions are locked while busy and time out after 30s for preview/90s for commit.
Saved contacts receive the current phone key, Individual type, Import source, creator and a contact-created timeline entry. Merged-away contacts do not block imports.
Apply the existing upstream database migrations; CSV adds no migration or environment variable. PapaParse and its TypeScript definitions are required dependencies added relative to upstream main.

## Verification

```bash
npm run test:csv
npx tsc --noEmit
npm run build
```

Integration checks: start a local app against a migrated, disposable PostgreSQL database named
`zedu_csv_import_test`; set `CSV_IMPORT_TEST_URL` to its localhost URL and
`CSV_IMPORT_TEST_DATABASE_URL` to that same database, with matching `AUTH_SECRET`, then run
`npm run test:csv:integration`. Without these opt-in variables the suite skips.
Use normal `DATABASE_URL`/authentication configuration for the app; SMTP/Google are unnecessary with a password account.
The integration suite creates temporary fixtures and removes them afterward; it does not provision a browser-test login.

The focused tests cover parsing, limits, shared validation, duplicate matching, exclusions,
request shape, report counts and safe error exports. The opt-in integration test covers permissions,
size/row limits, preview without writes, persistence, repeat/concurrent imports, exclusions,
a database row rejection and a 1,000-row commit. It also verifies existing contacts are not overwritten
and lead, call and task counts remain unchanged. Check the PR for results actually run on its revision.

For a manual UI check, open both entry points, upload the sample CSV, edit and exclude rows,
confirm, download any errors and close the results. Verify saved contacts appear in the directory.

## Boundaries

No retained import history, resumable jobs, lead creation or external synchronisation.
The lock coordinates CSV imports; simultaneous manual contact creation retains the existing race risk.
Preview reads stored contact phone/email keys into memory, suitable for the current MVP but not assessed at large directory sizes.
Role policy preserves current access; restricting import to admins would be a separate product decision.
This PR restores the complete CSV feature removed by PR #29, including the earlier importer
foundation and the review/validation improvements. The documentation and tests are tracked with
the implementation so future changes can be reviewed and verified together.
