import { and, asc, eq, gte, lt } from "drizzle-orm";
import { alias } from "drizzle-orm/sqlite-core";
import { getDb } from "@/db";
import { admins, calls, leads } from "@/db/schema";
import { requireAdmin } from "@/lib/auth";
import { leadStatusMeta } from "@/lib/lead-status";
import { OUTCOMES, isConnected, outcomeMeta } from "@/lib/outcomes";
import { listAdmins } from "@/lib/queries";
import { dayRange, fmtTime, isYmd, shiftYmd, todayYmd, ymdOf } from "@/lib/time";
import { ROW, buildXlsx, type Cell } from "@/lib/xlsx";

const MAX_DAYS = 366;

// GET /calls/export?from=YYYY-MM-DD&to=YYYY-MM-DD&a=<admin id>&o=<outcome>&type=overview
// Downloads the calls logged in that range (Pakistan time) as an Excel file. No dates means the current month so far.
// type=overview gives only the day-by-day overview (no list of individual calls).
const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
export async function GET(req: Request) {
  await requireAdmin();
  const sp = new URL(req.url).searchParams;
  const today = todayYmd();
  let from = isYmd(sp.get("from")) ? sp.get("from")! : `${today.slice(0, 8)}01`;
  let to = isYmd(sp.get("to")) ? sp.get("to")! : today;
  if (from > to) [from, to] = [to, from];

  const days = Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000) + 1;
  if (days > MAX_DAYS) return new Response(`Choose a range of at most ${MAX_DAYS} days.`, { status: 400 });

  const overviewOnly = sp.get("type") === "overview";
  const people = await listAdmins();
  const adminId = people.some((p) => p.id === sp.get("a")) ? sp.get("a")! : "";
  const outcome = OUTCOMES.some((o) => o.value === sp.get("o")) ? sp.get("o")! : "";

  const assignee = alias(admins, "assignee");
  const found = await getDb()
    .select({ call: calls, lead: leads, adminName: admins.fullName, adminUser: admins.username, assignedName: assignee.fullName, assignedUser: assignee.username })
    .from(calls)
    .innerJoin(leads, eq(calls.leadId, leads.id))
    .innerJoin(admins, eq(calls.adminId, admins.id))
    .leftJoin(assignee, eq(leads.assignedTo, assignee.id))
    .where(and(
      gte(calls.calledAt, dayRange(from)[0]), lt(calls.calledAt, dayRange(to)[1]),
      adminId ? eq(calls.adminId, adminId) : undefined,
      outcome ? eq(calls.outcome, outcome as "no_answer") : undefined,
    ))
    .orderBy(asc(calls.calledAt));

  const caller = (r: (typeof found)[number]) => r.adminName ?? r.adminUser;
  const callRows: Cell[][] = [["Date", "Time (PKT)", "Caller", "Company", "Contact", "Phone", "Email", "Outcome", "Notes", "Lead status", "Assigned to"]];
  for (const r of found) {
    callRows.push([
      ymdOf(r.call.calledAt), fmtTime(r.call.calledAt), caller(r), r.lead.company, r.lead.contactName, r.lead.phone, r.lead.email,
      outcomeMeta(r.call.outcome).label, r.call.notes, leadStatusMeta(r.lead.status).label,
      r.lead.assignedTo ? (r.assignedName ?? r.assignedUser) : "Unassigned",
    ]);
  }

  // Overview: one row per day of the range (days with no calls included), then one row per caller.
  type Tally = { calls: number; connected: number; failed: number; meetings: number };
  const blank = (): Tally => ({ calls: 0, connected: 0, failed: 0, meetings: 0 });
  const add = (t: Tally, o: string) => {
    t.calls++;
    if (isConnected(o)) t.connected++; else t.failed++;
    if (o === "meeting_booked") t.meetings++;
  };
  const perDay = new Map<string, Tally>();
  for (let d = from; d <= to; d = shiftYmd(d, 1)) perDay.set(d, blank());
  const perCaller = new Map<string, Tally>();
  const total = blank();
  for (const r of found) {
    add(perDay.get(ymdOf(r.call.calledAt)) ?? blank(), r.call.outcome);
    const name = caller(r);
    if (!perCaller.has(name)) perCaller.set(name, blank());
    add(perCaller.get(name)!, r.call.outcome);
    add(total, r.call.outcome);
  }

  const overview: Cell[][] = [["Date", "Day", "Calls made", "Connected", "No answer or failed", "Meetings booked", "Note"]];
  const rowStyles: Record<number, number> = {};
  let weekdays = 0, weekdaysWithCalls = 0, weekendDays = 0, weekendDaysWithCalls = 0;
  for (const [d, t] of perDay) {
    const dow = new Date(`${d}T00:00:00Z`).getUTCDay();
    const weekend = dow === 0 || dow === 6;
    if (weekend) { weekendDays++; if (t.calls) weekendDaysWithCalls++; } else { weekdays++; if (t.calls) weekdaysWithCalls++; }
    const note = weekend ? (t.calls ? "Weekend (calls made)" : "Weekend") : t.calls ? "" : "No calls";
    if (weekend) rowStyles[overview.length] = ROW.weekend;
    else if (!t.calls) rowStyles[overview.length] = ROW.empty;
    overview.push([d, DAY_NAMES[dow], t.calls, t.connected, t.failed, t.meetings, note]);
  }
  const totalRow = overview.length;
  overview.push(["Total", `${perDay.size} days`, total.calls, total.connected, total.failed, total.meetings, ""]);
  overview.push([]);
  overview.push(["Weekdays with calls", `${weekdaysWithCalls} of ${weekdays}`]);
  overview.push(["Weekdays with no calls", weekdays - weekdaysWithCalls]);
  overview.push(["Weekend days", weekendDays]);
  if (weekendDaysWithCalls) overview.push(["Weekend days with calls", weekendDaysWithCalls]);
  overview.push([]);
  const callerHeader = overview.length;
  overview.push(["Caller", "", "Calls made", "Connected", "No answer or failed", "Meetings booked", ""]);
  for (const [n, t] of [...perCaller].sort((a, b) => b[1].calls - a[1].calls)) overview.push([n, "", t.calls, t.connected, t.failed, t.meetings, ""]);

  const overviewSheet = {
    name: "Overview", rows: overview, widths: [20, 14, 12, 12, 20, 17, 22],
    headerRows: [0, callerHeader], boldRows: [totalRow], rowStyles,
  };
  const bytes = buildXlsx(overviewOnly ? [overviewSheet] : [
    { name: "Calls", rows: callRows, widths: [12, 11, 18, 28, 22, 18, 28, 24, 50, 15, 18], filter: true },
    overviewSheet,
  ]);
  const fileName = `calls${overviewOnly ? "-overview" : ""}_${from}_to_${to}.xlsx`;

  return new Response(new Blob([bytes as BlobPart]), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${fileName}"`,
      "Cache-Control": "no-store",
    },
  });
}
