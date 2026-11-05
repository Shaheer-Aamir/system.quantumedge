import { and, eq, gte, lt } from "drizzle-orm";
import { getDb } from "@/db";
import { admins, leads, meetings } from "@/db/schema";
import { requireAdmin } from "@/lib/auth";
import { getLeadHit } from "@/lib/lead-search";
import { listAdmins } from "@/lib/queries";
import { isYm, monthRange, todayYmd } from "@/lib/time";
import { PageHeader } from "@/components/coming-soon";
import { CalendarView, type MeetingItem } from "./calendar-view";

export default async function CalendarPage({ searchParams }: { searchParams: Promise<{ m?: string; a?: string; lead?: string }> }) {
  const me = await requireAdmin();
  const sp = await searchParams;
  const month = isYm(sp.m) ? sp.m : todayYmd().slice(0, 7);
  const people = await listAdmins();
  const adminId = people.some((p) => p.id === sp.a) ? sp.a! : "";

  // Fetch a week either side so days shown from neighbouring months are filled in.
  const [start, end] = monthRange(month);
  const db = getDb();
  const preselect = sp.lead ? await getLeadHit(db, sp.lead) : null;
  const rows = await db
    .select({ m: meetings, lead: leads, adminName: admins.fullName, adminUser: admins.username, adminAvatar: admins.avatar })
    .from(meetings)
    .innerJoin(leads, eq(meetings.leadId, leads.id))
    .innerJoin(admins, eq(meetings.adminId, admins.id))
    .where(and(gte(meetings.startsAt, start - 7 * 86_400_000), lt(meetings.startsAt, end + 7 * 86_400_000), adminId ? eq(meetings.adminId, adminId) : undefined));

  const items: MeetingItem[] = rows.map(({ m, lead, adminName, adminUser, adminAvatar }) => ({
    id: m.id, title: m.title, startsAt: m.startsAt, durationMin: m.durationMin, status: m.status, notes: m.notes,
    company: lead.company, contactName: lead.contactName, phone: lead.phone, email: lead.email,
    adminId: m.adminId, adminName: adminName ?? adminUser, adminAvatar,
  }));

  return (
    <>
      <PageHeader title="Meetings" description="Every booked meeting across the team. Times are shown in Pakistan time." />
      <CalendarView key={`${month}-${adminId}`} month={month} adminId={adminId} meetings={items} people={people} meId={me.id} isSuper={me.role === "super_admin"} preselect={preselect} />
    </>
  );
}
