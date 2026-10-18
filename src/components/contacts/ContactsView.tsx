"use client";

// Contacts list (Figma 16853:24154): tabs, search with highlighted matches (16853:23869), Company / Linked lead /
// Created filters, sort, and the Possible duplicates tab (16853:477416). Add contact: 16855:24896.

import { ArrowUpDown, Ellipsis, Plus, Trash, Upload, UserRoundPlus } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, useTransition, type ReactNode } from "react";
import { deleteContact } from "@/app/contacts/actions";
import {
  CONTACT_SORTS,
  CREATED_FILTERS,
  LINKED_FILTERS,
  type ContactListData,
  type ContactListParams,
  type ContactRow,
  type ContactSort,
  type CreatedFilter,
} from "@/lib/contactTypes";
import { phoneDigits, phoneSearchDigits } from "@/lib/leadForm";
import { PAGE_SIZE } from "@/lib/leadTypes";
import { LEAD_TYPES, STAGES } from "@/lib/status";
import {
  Button,
  Dropdown,
  FilterChip,
  IconButton,
  Menu,
  MenuDivider,
  MenuItem,
  MenuLabel,
  Modal,
  PageHeader,
  Search,
  StatusPill,
  Table,
  TableCell,
  TableHead,
  TableRow,
  Tabs,
  cx,
} from "@/components/zedu";
import { FilterPopover } from "@/components/leads/FilterPopover";
import { useLeadParams } from "@/components/leads/useLeadParams";
import { AddContactModal } from "./AddContactModal";
import { DuplicatesList } from "./Duplicates";
import ContactImport from "./ContactImport";

type Props = { params: ContactListParams; data: ContactListData };

/* ---------------------------------------------------------------------------------------------- */
/* Search matches                                                                                    */

type Field = "name" | "phone" | "email" | "company";
const FIELD_NAMES: Record<Field, string> = { name: "name", phone: "phone", email: "email", company: "company" };

/** [start, end) of the search text inside `text`. Phones match on digits, so "0803 123" finds "+234 803 123…". */
function matchRange(text: string | null, q: string, phone = false): [number, number] | null {
  if (!text || !q) return null;
  const i = text.toLowerCase().indexOf(q.toLowerCase());
  if (i >= 0) return [i, i + q.length];
  if (!phone) return null;
  const want = phoneSearchDigits(q);
  if (want.length < 3) return null;
  const positions = [...text].flatMap((ch, idx) => (/\d/.test(ch) ? [idx] : []));
  const at = phoneDigits(text).indexOf(want);
  if (at < 0) return null;
  return [positions[at], positions[at + want.length - 1] + 1];
}

function Highlight({ text, q, phone }: { text: string; q: string; phone?: boolean }) {
  const r = matchRange(text, q, phone);
  if (!r) return <>{text}</>;
  return (
    <>
      {text.slice(0, r[0])}
      <mark className="bg-transparent font-semibold text-z-fg">{text.slice(r[0], r[1])}</mark>
      {text.slice(r[1])}
    </>
  );
}

function matchedField(row: ContactRow, q: string): Field | null {
  if (matchRange(row.name, q)) return "name";
  if (matchRange(row.phone, q, true)) return "phone";
  if (matchRange(row.email, q)) return "email";
  if (matchRange(row.company, q)) return "company";
  return null;
}

function joinWords(words: string[]) {
  return words.length <= 1 ? words.join("") : `${words.slice(0, -1).join(", ")} and ${words[words.length - 1]}`;
}

/* ---------------------------------------------------------------------------------------------- */

export function ContactsView({ params, data }: Props) {
  const router = useRouter();
  const search = useSearchParams();
  const { set, pending } = useLeadParams();
  const [q, setQ] = useState(params.q);
  const [deleting, setDeleting] = useState<ContactRow | null>(null);
  const [busy, startTransition] = useTransition();
  const [importing, setImporting] = useState(false);
  const [imported, setImported] = useState(false);
  const addOpen = search.get("new") === "1";
  const duplicates = params.tab === "duplicates";

  // Debounced search.
  useEffect(() => {
    if (q === params.q) return;
    const t = setTimeout(() => set({ q: q.trim() || null }), 300);
    return () => clearTimeout(t);
  }, [q, params.q, set]);

  const filtersActive = params.companies.length + params.linked.length > 0 || !!params.created || !!params.q;
  const fields = params.q
    ? ([...new Set(data.rows.map((r) => matchedField(r, params.q)).filter(Boolean))] as Field[]).map((f) => FIELD_NAMES[f])
    : [];

  const first = (data.page - 1) * PAGE_SIZE + 1;
  const last = first + data.rows.length - 1;

  return (
    <>
      <PageHeader
        title="Contacts"
        count={data.tabCounts.all.toLocaleString("en-US")}
        description="Everyone you talk to, with or without a lead. One record per person or business — leads, calls and tasks link to it."
        actions={
          <>
            <Button variant="secondary" size="sm" icon={<Upload aria-hidden />} onClick={() => { setImported(false); setImporting(true); }}>
              Import CSV
            </Button>
            <Button variant="secondary" size="sm" icon={<Plus aria-hidden />} onClick={() => set({ new: "1" })}>
              Add contact
            </Button>
          </>
        }
        tabs={
          <Tabs
            label="Contact views"
            value={params.tab}
            onChange={(tab) => set({ tab: tab === "all" ? null : tab })}
            options={[
              { value: "all", label: "All", count: data.tabCounts.all },
              { value: "individuals", label: "Individuals", count: data.tabCounts.individuals },
              { value: "businesses", label: "Businesses", count: data.tabCounts.businesses },
              { value: "duplicates", label: "Possible duplicates", count: data.tabCounts.duplicates },
            ]}
          />
        }
      />

      <div className={cx("flex flex-col gap-3 px-6 pb-24 pt-4 transition-opacity duration-150 max-sm:px-4", pending && "opacity-60")} aria-busy={pending}>
        {duplicates ? (
          <DuplicatesList pairs={data.pairs} />
        ) : (
          <>
            {/* Filter bar */}
            <div className="flex flex-wrap items-center gap-2">
              <Search
                size="sm"
                placeholder="Search name, phone, email or company"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                className="w-[320px] max-sm:w-full"
              />
              <FilterPopover
                field="Company"
                heading="Company"
                options={data.companies.map((c) => ({ value: c, label: c }))}
                selected={params.companies}
                onChange={(v) => set({ company: v.join("|") || null })}
              />
              <FilterPopover
                field="Linked lead"
                heading="Linked lead"
                options={(Object.keys(LINKED_FILTERS) as (keyof typeof LINKED_FILTERS)[]).map((k) => ({ value: k, label: LINKED_FILTERS[k] }))}
                selected={params.linked}
                onChange={(v) => set({ linked: v })}
              />
              <Dropdown
                trigger={(p) => (
                  <FilterChip
                    label={params.created ? `Created: ${CREATED_FILTERS[params.created]}` : "Created"}
                    active={!!params.created}
                    onClear={() => set({ created: null })}
                    {...p}
                  />
                )}
              >
                <Menu label="Created" className="w-48">
                  <MenuLabel>Created</MenuLabel>
                  {(Object.keys(CREATED_FILTERS) as CreatedFilter[]).map((k) => (
                    <MenuItem key={k} onSelect={() => set({ created: k })}>
                      <span className={params.created === k ? "font-medium" : undefined}>{CREATED_FILTERS[k]}</span>
                    </MenuItem>
                  ))}
                  {params.created && (
                    <>
                      <MenuDivider />
                      <MenuItem onSelect={() => set({ created: null })}>
                        <span className="text-z-fg-secondary">Any time</span>
                      </MenuItem>
                    </>
                  )}
                </Menu>
              </Dropdown>
              {filtersActive && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setQ("");
                    set({ q: null, company: null, linked: null, created: null });
                  }}
                >
                  Clear all
                </Button>
              )}
              <div className="flex-1" />
              {params.q ? (
                <p className="text-z-small text-z-fg-muted" role="status">
                  {data.total.toLocaleString("en-US")} {data.total === 1 ? "match" : "matches"} for &ldquo;{params.q}&rdquo;
                  {fields.length > 0 && ` in ${joinWords(fields)}`}
                </p>
              ) : (
                <Dropdown
                  align="end"
                  trigger={(p) => (
                    <Button variant="ghost" size="sm" icon={<ArrowUpDown aria-hidden />} {...p}>
                      {CONTACT_SORTS[params.sort]}
                    </Button>
                  )}
                >
                  <Menu label="Sort contacts" className="w-52">
                    {(Object.keys(CONTACT_SORTS) as ContactSort[]).map((s) => (
                      <MenuItem key={s} onSelect={() => set({ sort: s === "name" ? null : s })}>
                        <span className={params.sort === s ? "font-medium" : undefined}>{CONTACT_SORTS[s]}</span>
                      </MenuItem>
                    ))}
                  </Menu>
                </Dropdown>
              )}
            </div>

            {/* Table */}
            <div className="overflow-hidden rounded-z-xl border border-z-line bg-z-surface shadow-z-sm">
              {data.rows.length === 0 ? (
                <div className="flex flex-col items-center gap-1 px-6 py-16 text-center">
                  <p className="text-z-small font-medium text-z-fg">{filtersActive ? "No contacts match" : "No contacts yet"}</p>
                  <p className="text-z-caption text-z-fg-muted">
                    {filtersActive
                      ? "Try a different search or clear the filters. Phone numbers match in any format."
                      : "Add the people and businesses you talk to. Every new lead adds a contact too."}
                  </p>
                </div>
              ) : (
                <Table className="min-w-[1132px] table-fixed">
                  <colgroup>
                    <col className="w-[210px]" />
                    <col className="w-[160px]" />
                    <col className="w-[210px]" />
                    <col className="w-[150px]" />
                    <col className="w-[140px]" />
                    <col className="w-[140px]" />
                    <col className="w-[130px]" />
                    <col className="w-[52px]" />
                  </colgroup>
                  <thead>
                    <tr>
                      <TableHead sort={params.sort === "name" ? "asc" : "none"} onSort={() => set({ sort: null })}>
                        Contact
                      </TableHead>
                      <TableHead>Phone</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Company</TableHead>
                      <TableHead>Linked lead</TableHead>
                      <TableHead sort={params.sort === "last" ? "desc" : "none"} onSort={() => set({ sort: "last" })}>
                        Last interaction
                      </TableHead>
                      <TableHead sort={params.sort === "created" ? "desc" : "none"} onSort={() => set({ sort: "created" })}>
                        Created
                      </TableHead>
                      <TableHead>
                        <span className="sr-only">Actions</span>
                      </TableHead>
                    </tr>
                  </thead>
                  <tbody>
                    {data.rows.map((c) => (
                      <ContactTableRow
                        key={c.id}
                        row={c}
                        q={params.q}
                        onOpen={() => router.push(`/contacts/${c.id}`)}
                        onCreateLead={() => router.push(`/contacts/${c.id}?lead=new`)}
                        onDelete={() => setDeleting(c)}
                      />
                    ))}
                  </tbody>
                </Table>
              )}
            </div>

            {data.pageCount > 1 && (
              <div className="flex items-center justify-between gap-3 text-z-caption text-z-fg-muted">
                <span>
                  Showing {first}–{last} of {data.total.toLocaleString("en-US")}
                </span>
                <div className="flex gap-2">
                  <Button variant="secondary" size="sm" disabled={data.page <= 1} onClick={() => set({ page: String(data.page - 1) })}>
                    Previous
                  </Button>
                  <Button variant="secondary" size="sm" disabled={data.page >= data.pageCount} onClick={() => set({ page: String(data.page + 1) })}>
                    Next
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      <Modal
        open={!!deleting}
        onClose={() => setDeleting(null)}
        width={440}
        title={`Delete ${deleting?.name ?? "contact"}?`}
        description={
          deleting?.lead
            ? "Their leads, tasks, notes and timeline are removed too. Logged calls stay in your reports. This can't be undone."
            : "Their tasks, notes and timeline are removed. Logged calls stay in your reports. This can't be undone."
        }
        footer={
          <>
            <Button variant="secondary" onClick={() => setDeleting(null)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              disabled={busy}
              onClick={() =>
                deleting &&
                startTransition(async () => {
                  await deleteContact(deleting.id);
                  setDeleting(null);
                })
              }
            >
              Delete contact
            </Button>
          </>
        }
      >
        <p className="text-z-small text-z-fg-secondary">
          {deleting?.code}
          {deleting?.lead && ` · Lead ${deleting.lead.code}`}
        </p>
      </Modal>

      <AddContactModal open={addOpen} onClose={() => set({ new: null })} />
      {importing && (
        <ContactImport
          onImported={() => setImported(true)}
          onClose={() => {
            setImporting(false);
            if (imported) router.refresh();
          }}
        />
      )}
    </>
  );
}

function ContactTableRow({
  row: c,
  q,
  onOpen,
  onCreateLead,
  onDelete,
}: {
  row: ContactRow;
  q: string;
  onOpen: () => void;
  onCreateLead: () => void;
  onDelete: () => void;
}) {
  const muted = (v: ReactNode) => <span className="text-z-fg-placeholder">{v}</span>;
  return (
    <TableRow
      className="cursor-pointer"
      onClick={(e) => {
        if ((e.target as HTMLElement).closest("a, button, input, label, [role=menu]")) return;
        onOpen();
      }}
    >
      <TableCell>
        <Link href={`/contacts/${c.id}`} className="z-focus block truncate rounded-z-xs text-z-small font-medium text-z-fg hover:underline">
          <Highlight text={c.name} q={q} />
        </Link>
        <p className="truncate text-z-caption text-z-fg-muted">
          {c.code} · {LEAD_TYPES[c.type].label}
        </p>
      </TableCell>
      <TableCell className="truncate">
        <Highlight text={c.phone} q={q} phone />
      </TableCell>
      <TableCell className="truncate" title={c.email ?? undefined}>
        {c.email ? <Highlight text={c.email} q={q} /> : muted("—")}
      </TableCell>
      <TableCell className="truncate" title={c.company ?? undefined}>
        {c.company ? <Highlight text={c.company} q={q} /> : muted("—")}
      </TableCell>
      <TableCell>
        {c.lead ? (
          <span className="flex items-center gap-1.5">
            <Link
              href={`/leads/${c.lead.id}`}
              aria-label={`Lead ${c.lead.code} · ${STAGES[c.lead.status].label}`}
              title={c.lead.code}
              className="z-focus min-w-0 rounded-full"
            >
              <StatusPill stage={STAGES[c.lead.status].stage} label={STAGES[c.lead.status].label} />
            </Link>
            {c.lead.more > 0 && <span className="text-z-caption text-z-fg-muted">+{c.lead.more}</span>}
          </span>
        ) : (
          muted("No lead")
        )}
      </TableCell>
      <TableCell className="truncate">{c.lastInteraction ?? muted("—")}</TableCell>
      <TableCell className="truncate">{c.created}</TableCell>
      <TableCell type="actions" className="!px-2">
        <Dropdown
          align="end"
          trigger={(p) => (
            <IconButton label={`Actions for ${c.name}`} {...p}>
              <Ellipsis aria-hidden />
            </IconButton>
          )}
        >
          <Menu label={`Actions for ${c.name}`} className="w-48 text-left">
            <MenuItem onSelect={onOpen}>Open contact</MenuItem>
            <MenuItem icon={<UserRoundPlus />} onSelect={onCreateLead}>
              Create lead
            </MenuItem>
            <MenuDivider />
            <MenuItem tone="danger" icon={<Trash />} onSelect={onDelete}>
              Delete
            </MenuItem>
          </Menu>
        </Dropdown>
      </TableCell>
    </TableRow>
  );
}
