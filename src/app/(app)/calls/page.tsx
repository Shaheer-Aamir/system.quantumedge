import Link from "next/link";
import { and, desc, eq, gte, lt } from "drizzle-orm";
import { getDb } from "@/db";
import { admins, calls, leads } from "@/db/schema";
import { requireAdmin } from "@/lib/auth";
import { getLeadHit } from "@/lib/lead-search";
import { listAdmins } from "@/lib/queries";
import { isConnected, outcomeMeta } from "@/lib/outcomes";
import { dayRange, fmtDayLong, fmtTime, isYmd, shiftYmd, todayYmd } from "@/lib/time";
import { PageHeader } from "@/components/coming-soon";
import { Avatar } from "@/components/avatar";
import { ghostBtn } from "@/components/form-styles";
import { CallLogger } from "./call-logger";
import { DayPicker } from "./day-picker";
import { DeleteCallButton } from "./delete-call-button";

export default async function CallsPage({ searchParams }: { searchParams: Promise<{ d?: string; a?: string; lead?: string }> }) {
  const me = await requireAdmin();
  const sp = await searchParams;
  const today = todayYmd();
  const day = isYmd(sp.d) ? sp.d : today;
  const people = await listAdmins();
  const adminId = people.some((p) => p.id === sp.a) ? sp.a! : "";
  const [start, end] = dayRange(day);
  const db = getDb();
  const preselected = sp.lead ? await getLeadHit(db, sp.lead) : null;

  const rows = await db
    .select({
      call: calls, lead: leads, adminName: admins.fullName, adminUser: admins.username, adminAvatar: admins.avatar,
    })
    .from(calls)
    .innerJoin(leads, eq(calls.leadId, leads.id))
    .innerJoin(admins, eq(calls.adminId, admins.id))
    .where(and(gte(calls.calledAt, start), lt(calls.calledAt, end), adminId ? eq(calls.adminId, adminId) : undefined))
    .orderBy(desc(calls.calledAt));

  const stats = [
    { label: "Calls made", value: rows.length, icon: "bi-telephone" },
    { label: "Connected", value: rows.filter((r) => isConnected(r.call.outcome)).length, icon: "bi-telephone-inbound" },
    { label: "No answer or failed", value: rows.filter((r) => !isConnected(r.call.outcome)).length, icon: "bi-telephone-x" },
    { label: "Meetings booked", value: rows.filter((r) => r.call.outcome === "meeting_booked").length, icon: "bi-calendar-check" },
  ];

  const link = (d: string, a: string) => `/calls?d=${d}${a ? `&a=${a}` : ""}`;

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
          <DayPicker day={day} adminId={adminId} />
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

      {rows.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-line px-6 py-14 text-center">
          <p className="font-medium">No calls logged for this day</p>
          <p className="mt-1 text-sm text-muted">Use Log a call to add the first one.</p>
        </div>
      ) : (
        <ul className="space-y-3">
          {rows.map(({ call, lead, adminName, adminUser, adminAvatar }) => {
            const meta = outcomeMeta(call.outcome);
            const name = adminName ?? adminUser;
            const canDelete = call.adminId === me.id || me.role === "super_admin";
            return (
              <li key={call.id} className="flex flex-wrap items-center gap-x-5 gap-y-3 rounded-2xl border border-line bg-surface/60 p-4">
                <p className="w-16 shrink-0 text-sm font-medium tabular-nums">{fmtTime(call.calledAt)}</p>
                <div className="min-w-[12rem] flex-1">
                  <p className="font-medium">{lead.company || lead.contactName}</p>
                  <p className="text-sm text-muted">
                    {lead.company && lead.contactName ? `${lead.contactName} · ` : ""}
                    <a href={`tel:${lead.phoneNormalized}`} className="hover:text-fg">{lead.phone}</a>
                  </p>
                  {call.notes && <p className="mt-1.5 text-sm text-muted">{call.notes}</p>}
                </div>
                <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ${meta.tone}`}>
                  <i className={`bi ${meta.icon}`} aria-hidden="true" /> {meta.label}
                </span>
                <div className="flex items-center gap-2 text-sm text-muted" title={name}>
                  <Avatar name={name} src={adminAvatar} size={26} />
                  <span className="hidden sm:inline">{name}</span>
                </div>
                {canDelete && <DeleteCallButton id={call.id} />}
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
