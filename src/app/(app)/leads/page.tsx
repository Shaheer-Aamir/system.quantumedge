import Link from "next/link";
import { getDb } from "@/db";
import { requireAdmin } from "@/lib/auth";
import { followUpCount, leadCountsByDay, leadStatusCounts, PAGE_SIZES, parseFilters, queryLeads, type LeadFilters } from "@/lib/lead-queries";
import { listAdmins } from "@/lib/queries";
import { fmtDayLong, shiftYmd, todayYmd } from "@/lib/time";
import { PageHeader } from "@/components/coming-soon";
import { ghostBtn } from "@/components/form-styles";
import { AddLead } from "./add-lead";
import { ImportLeads } from "./import-leads";
import { LeadsTable } from "./leads-table";
import { LeadsToolbar } from "./leads-toolbar";
import type { LeadRow } from "./lead-detail";

function parseExtra(s: string | null): Record<string, string> {
  try {
    const o = s ? JSON.parse(s) : {};
    return o && typeof o === "object" ? o : {};
  } catch {
    return {};
  }
}

function pageHref(f: LeadFilters, page: number) {
  const p = new URLSearchParams();
  if (f.q) p.set("q", f.q);
  if (f.date) p.set("date", f.date);
  if (f.followup) p.set("followup", "1");
  if (f.size !== PAGE_SIZES[0]) p.set("size", String(f.size));
  if (f.status) p.set("status", f.status);
  if (f.assigned) p.set("assigned", f.assigned);
  if (f.sort !== "newest") p.set("sort", f.sort);
  if (page > 1) p.set("page", String(page));
  return `/leads${p.size ? `?${p}` : ""}`;
}

export default async function LeadsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const me = await requireAdmin();
  const people = await listAdmins();
  const filters = parseFilters(await searchParams, people.map((p) => p.id));
  const db = getDb();
  const today = todayYmd();
  const yesterday = shiftYmd(today, -1);
  const [{ total, rows }, counts, dayCounts, followUps] = await Promise.all([
    queryLeads(db, filters), leadStatusCounts(db, filters.date), leadCountsByDay(db, [today, yesterday]), followUpCount(db),
  ]);

  const items: LeadRow[] = rows.map(({ lead, assignedName, assignedUser, callCount, lastCalled, lastOutcome }) => ({
    id: lead.id, company: lead.company, contactName: lead.contactName, phone: lead.phone, email: lead.email,
    status: lead.status, assignedTo: lead.assignedTo, assignedName: lead.assignedTo ? (assignedName ?? assignedUser) : null,
    notes: lead.notes, extra: parseExtra(lead.extra), callCount: Number(callCount), lastOutcome: lastOutcome ?? null, lastCalledAt: lastCalled ? Number(lastCalled) : null,
    createdAt: lead.createdAt, source: lead.source,
  }));

  const pages = Math.max(1, Math.ceil(total / filters.size));
  const page = Math.min(filters.page, pages);
  const all = Object.values(counts).reduce((a, b) => a + b, 0);
  const stats = [
    { label: filters.date ? "Leads from this day" : "Total leads", value: all, icon: "bi-people" },
    { label: "Not contacted", value: counts.new ?? 0, icon: "bi-person-plus" },
    { label: "Contacted", value: counts.contacted ?? 0, icon: "bi-telephone-outbound" },
    { label: "Meetings booked", value: counts.meeting_booked ?? 0, icon: "bi-calendar-check" },
    { label: "Closed", value: counts.closed ?? 0, icon: "bi-trophy" },
  ];

  return (
    <>
      <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <PageHeader title="Leads" description="Upload lists, assign them to callers and follow every lead from first call to close." />
        <div className="flex flex-wrap gap-3"><AddLead people={people} /><ImportLeads people={people} /></div>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-5">
        {stats.map((s) => (
          <div key={s.label} className="rounded-2xl border border-line bg-surface/60 p-4">
            <p className="flex items-center gap-2 text-sm text-muted"><i className={`bi ${s.icon}`} aria-hidden="true" /> {s.label}</p>
            <p className="mt-2 text-3xl font-semibold">{s.value.toLocaleString()}</p>
          </div>
        ))}
      </div>

      {filters.date && (
        <p className="mb-4 flex flex-wrap items-center gap-x-3 text-sm">
          <span><i className="bi bi-calendar-check mr-2 text-ice" aria-hidden="true" />Showing leads imported on <strong>{fmtDayLong(filters.date)}</strong>. The numbers above are for this day only.</span>
        </p>
      )}
      {filters.followup && (
        <p className="mb-4 text-sm">
          <i className="bi bi-telephone-forward mr-2 text-ice" aria-hidden="true" />Showing leads waiting for another call: follow-ups, and people who picked up but had no time to talk.
          {filters.sort === "waiting" && " The ones waiting longest are first."}
        </p>
      )}
      <LeadsToolbar filters={filters} people={people} followUps={followUps} days={{ today, todayCount: dayCounts[today], yesterday, yesterdayCount: dayCounts[yesterday] }} />
      <LeadsTable key={`${filters.q}${filters.followup}${filters.date}${filters.status}${filters.assigned}${filters.sort}${filters.size}${page}`} rows={items} people={people} isSuper={me.role === "super_admin"} />

      {total > 0 && (
        <nav className="mt-5 flex flex-wrap items-center justify-between gap-3 text-sm" aria-label="Pagination">
          <p className="text-muted">{total.toLocaleString()} lead{total === 1 ? "" : "s"} · page {page} of {pages}</p>
          <div className="flex gap-2">
            {page > 1 && <Link href={pageHref(filters, page - 1)} className={ghostBtn}><i className="bi bi-chevron-left" aria-hidden="true" /> Previous</Link>}
            {page < pages && <Link href={pageHref(filters, page + 1)} className={ghostBtn}>Next <i className="bi bi-chevron-right" aria-hidden="true" /></Link>}
          </div>
        </nav>
      )}
    </>
  );
}
