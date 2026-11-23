import { and, asc, eq, gte, lt } from "drizzle-orm";
import { alias } from "drizzle-orm/sqlite-core";
import { getDb } from "@/db";
import { admins, calls, leads } from "@/db/schema";
import { requireAdmin } from "@/lib/auth";
import { leadStatusMeta } from "@/lib/lead-status";
import { OUTCOMES, isConnected, outcomeMeta } from "@/lib/outcomes";
import { listAdmins } from "@/lib/queries";
import { dayRange, fmtTime, isYmd, shiftYmd, todayYmd, ymdOf } from "@/lib/time";
import { buildXlsx, type Cell } from "@/lib/xlsx";

const MAX_DAYS = 366;

// GET /calls/export?from=YYYY-MM-DD&to=YYYY-MM-DD&a=<admin id>&o=<outcome>
// Downloads the calls logged in that range (Pakistan time) as an Excel file. No dates means the current month so far.
export async function GET(req: Request) {
  await requireAdmin();
  const sp = new URL(req.url).searchParams;
  const today = todayYmd();
  let from = isYmd(sp.get("from")) ? sp.get("from")! : `${today.slice(0, 8)}01`;
  let to = isYmd(sp.get("to")) ? sp.get("to")! : today;
  if (from > to) [from, to] = [to, from];

  const days = Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000) + 1;
  if (days > MAX_DAYS) return new Response(`Choose a range of at most ${MAX_DAYS} days.`, { status: 400 });

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

  // Summary: one row per day (including days with no calls), then one row per caller.
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
  const line = (label: string, t: Tally): Cell[] => [label, t.calls, t.connected, t.failed, t.meetings];
  const summary: Cell[][] = [
    ["Date", "Calls made", "Connected", "No answer or failed", "Meetings booked"],
    ...[...perDay].map(([d, t]) => line(d, t)),
    line("Total", total),
    [],
    ["Caller", "Calls made", "Connected", "No answer or failed", "Meetings booked"],
    ...[...perCaller].sort((a, b) => b[1].calls - a[1].calls).map(([n, t]) => line(n, t)),
  ];

  const bytes = buildXlsx([
    { name: "Calls", rows: callRows, widths: [12, 11, 18, 28, 22, 18, 28, 24, 50, 15, 18], filter: true },
    { name: "Summary", rows: summary, widths: [20, 12, 12, 20, 16], headerRows: [0, perDay.size + 3], boldRows: [perDay.size + 1] },
  ]);

  return new Response(new Blob([bytes as BlobPart]), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="calls_${from}_to_${to}.xlsx"`,
      "Cache-Control": "no-store",
    },
  });
}
