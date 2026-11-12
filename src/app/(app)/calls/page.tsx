import Link from "next/link";
import { and, desc, eq, gte, lt, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/sqlite-core";
import { getDb } from "@/db";
import { admins, calls, leads } from "@/db/schema";
import { requireAdmin } from "@/lib/auth";
import { getLeadHit } from "@/lib/lead-search";
import { listAdmins } from "@/lib/queries";
import { OUTCOMES, isConnected, outcomeMeta } from "@/lib/outcomes";
import { dayRange, fmtDayLong, isYmd, shiftYmd, todayYmd } from "@/lib/time";
import { PageHeader } from "@/components/coming-soon";
import { ghostBtn } from "@/components/form-styles";
import { CallLogger } from "./call-logger";
import { DayPicker } from "./day-picker";
import { CallsList } from "./calls-list";
import type { CallRowData } from "./call-edit-form";

function parseExtra(s: string | null): Record<string, string> {
  try {
    const o = s ? JSON.parse(s) : {};
    return o && typeof o === "object" ? o : {};
  } catch {
    return {};
  }
}

// Full table names on purpose: these run inside a query that already has a "calls" table.
const leadCalls = sql<number>`(select count(*) from "calls" as lc where lc."lead_id" = "leads"."id")`;
const leadLastOutcome = sql<string | null>`(select lc."outcome" from "calls" as lc where lc."lead_id" = "leads"."id" order by lc."called_at" desc limit 1)`;
const leadLastCalled = sql<number | null>`(select max(lc."called_at") from "calls" as lc where lc."lead_id" = "leads"."id")`;
const linkedMeetings = sql<number>`(select count(*) from "meetings" where "meetings"."call_id" = "calls"."id")`;
const scheduledMeetings = sql<number>`(select count(*) from "meetings" where "meetings"."call_id" = "calls"."id" and "meetings"."status" = 'scheduled')`;

export default async function CallsPage({ searchParams }: { searchParams: Promise<{ d?: string; a?: string; o?: string; lead?: string }> }) {
  const me = await requireAdmin();
  const sp = await searchParams;
  const today = todayYmd();
  const day = isYmd(sp.d) ? sp.d : today;
  const people = await listAdmins();
  const adminId = people.some((p) => p.id === sp.a) ? sp.a! : "";
  const outcome = OUTCOMES.some((o) => o.value === sp.o) ? sp.o! : "";
  const [start, end] = dayRange(day);
  const db = getDb();
  const preselected = sp.lead ? await getLeadHit(db, sp.lead) : null;
  const assignee = alias(admins, "assignee");

  const found = await db
    .select({
      call: calls, lead: leads, adminName: admins.fullName, adminUser: admins.username, adminAvatar: admins.avatar,
      assignedName: assignee.fullName, assignedUser: assignee.username,
      leadCalls, leadLastOutcome, leadLastCalled, linkedMeetings, scheduledMeetings,
    })
    .from(calls)
    .innerJoin(leads, eq(calls.leadId, leads.id))
    .innerJoin(admins, eq(calls.adminId, admins.id))
    .leftJoin(assignee, eq(leads.assignedTo, assignee.id))
    .where(and(gte(calls.calledAt, start), lt(calls.calledAt, end), adminId ? eq(calls.adminId, adminId) : undefined))
    .orderBy(desc(calls.calledAt));

  const all: CallRowData[] = found.map((r) => ({
    id: r.call.id, calledAt: r.call.calledAt, outcome: r.call.outcome, notes: r.call.notes,
    adminId: r.call.adminId, adminName: r.adminName ?? r.adminUser, adminAvatar: r.adminAvatar,
    canManage: r.call.adminId === me.id || me.role === "super_admin",
    linkedMeetings: Number(r.linkedMeetings), scheduledMeetings: Number(r.scheduledMeetings),
    lead: {
      id: r.lead.id, company: r.lead.company, contactName: r.lead.contactName, phone: r.lead.phone, email: r.lead.email,
      status: r.lead.status, assignedTo: r.lead.assignedTo, assignedName: r.lead.assignedTo ? (r.assignedName ?? r.assignedUser) : null,
      notes: r.lead.notes, extra: parseExtra(r.lead.extra), callCount: Number(r.leadCalls), lastOutcome: r.leadLastOutcome ?? null,
      lastCalledAt: r.leadLastCalled ? Number(r.leadLastCalled) : null, createdAt: r.lead.createdAt, source: r.lead.source,
    },
  }));
  const rows = outcome ? all.filter((r) => r.outcome === outcome) : all;

  const stats = [
    { label: "Calls made", value: all.length, icon: "bi-telephone" },
    { label: "Connected", value: all.filter((r) => isConnected(r.outcome)).length, icon: "bi-telephone-inbound" },
    { label: "No answer or failed", value: all.filter((r) => !isConnected(r.outcome)).length, icon: "bi-telephone-x" },
    { label: "Meetings booked", value: all.filter((r) => r.outcome === "meeting_booked").length, icon: "bi-calendar-check" },
  ];
  const counts = Object.fromEntries(OUTCOMES.map((o) => [o.value, all.filter((r) => r.outcome === o.value).length]));

  const link = (d: string, a: string, o = outcome) => `/calls?d=${d}${a ? `&a=${a}` : ""}${o ? `&o=${o}` : ""}`;

  return (
    <>
      <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <PageHeader title="Daily calls" description={fmtDayLong(day)} />
        <CallLogger preselected={preselected} defaultOpen={!!preselected} />
      </div>

      <div className="mb-6 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <Link href={link(shiftYmd(day, -1), adminId)} aria-label="Previous day" className={`${ghostBtn} !px-3`}>
            <i className="bi bi-chevron-left" aria-hidden="true" />
          </Link>
          <DayPicker day={day} adminId={adminId} outcome={outcome} />
          <Link href={link(shiftYmd(day, 1), adminId)} aria-label="Next day" className={`${ghostBtn} !px-3`}>
            <i className="bi bi-chevron-right" aria-hidden="true" />
          </Link>
          {day !== today && <Link href={link(today, adminId)} className={ghostBtn}>Today</Link>}
        </div>

        <div className="flex flex-wrap gap-2 sm:ml-auto" role="group" aria-label="Filter by admin">
          {[{ id: "", name: "All admins" }, ...people].map((p) => (
            <Link key={p.id || "all"} href={link(day, p.id)} aria-current={adminId === p.id ? "true" : undefined}
              className={`rounded-full border px-3.5 py-1.5 text-sm transition ${
                adminId === p.id ? "border-ice bg-accent/20 text-fg" : "border-line text-muted hover:text-fg"
              }`}>
              {p.name}{p.id === me.id ? " (you)" : ""}
            </Link>
          ))}
        </div>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label} className="rounded-2xl border border-line bg-surface/60 p-4">
            <p className="flex items-center gap-2 text-sm text-muted"><i className={`bi ${s.icon}`} aria-hidden="true" /> {s.label}</p>
            <p className="mt-2 text-3xl font-semibold">{s.value}</p>
          </div>
        ))}
      </div>

      <div className="mb-5 flex flex-wrap items-center gap-2" role="group" aria-label="Filter by call type">
        <span className="mr-1 text-sm text-muted">Call type</span>
        <Link href={link(day, adminId, "")} aria-current={!outcome ? "true" : undefined}
          className={`rounded-full border px-3.5 py-1.5 text-sm transition ${!outcome ? "border-ice bg-accent/20 text-fg" : "border-line text-muted hover:text-fg"}`}>
          All types <span className="text-xs text-muted">{all.length}</span>
        </Link>
        {OUTCOMES.map((o) => (
          <Link key={o.value} href={link(day, adminId, o.value)} aria-current={outcome === o.value ? "true" : undefined}
            className={`flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-sm transition ${outcome === o.value ? "border-ice bg-accent/20 text-fg" : "border-line text-muted hover:text-fg"}`}>
            <i className={`bi ${o.icon}`} aria-hidden="true" /> {o.label} <span className="text-xs text-muted">{counts[o.value]}</span>
          </Link>
        ))}
      </div>

      {outcome && rows.length > 0 && (
        <p className="mb-4 text-sm text-muted">Showing {rows.length} of {all.length} calls: {outcomeMeta(outcome).label.toLowerCase()}.</p>
      )}

      {all.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-line px-6 py-14 text-center">
          <p className="font-medium">No calls logged for this day</p>
          <p className="mt-1 text-sm text-muted">Use Log a call to add the first one.</p>
        </div>
      ) : rows.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-line px-6 py-14 text-center">
          <p className="font-medium">No {outcomeMeta(outcome).label.toLowerCase()} calls on this day</p>
          <p className="mt-1 text-sm text-muted">Choose All types to see every call.</p>
        </div>
      ) : (
        <CallsList rows={rows} people={people} isSuper={me.role === "super_admin"} />
      )}
    </>
  );
}
