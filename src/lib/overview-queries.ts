import { and, eq, gte, lt, sql } from "drizzle-orm";
import { admins, calls, meetings, payments, projects } from "@/db/schema";
import { OUTCOMES, isConnected } from "./outcomes";
import { leads } from "@/db/schema";
import { NEEDS_FOLLOW_UP } from "./lead-queries";
import { TZ_OFFSET_MS, daysInMonth, fmtMonthShort, monthRange, shiftYm } from "./time";
import type { Db } from "@/db/types";


const OFF = sql.raw(String(TZ_OFFSET_MS));
const localKey = (col: unknown, fmt: string) => sql<string>`strftime(${sql.raw(`'${fmt}'`)}, (${col} + ${OFF}) / 1000, 'unixepoch')`;

export async function overviewData(db: Db, ym: string, adminId: string) {
  const [from, to] = monthRange(ym);
  const prev = shiftYm(ym, -1);
  const [pFrom, pTo] = monthRange(prev);
  const [sixFrom] = monthRange(shiftYm(ym, -5));

  const callsIn = (a: number, b: number) => and(gte(calls.calledAt, a), lt(calls.calledAt, b), adminId ? eq(calls.adminId, adminId) : undefined);
  const meetingsMade = (a: number, b: number) => and(gte(meetings.createdAt, a), lt(meetings.createdAt, b), adminId ? eq(meetings.adminId, adminId) : undefined);
  const projectsIn = (a: number, b: number) => and(gte(projects.createdAt, a), lt(projects.createdAt, b), adminId ? eq(projects.ownerId, adminId) : undefined);
  const count = sql<number>`count(*)`;

  const day = localKey(calls.calledAt, "%Y-%m-%d");
  const payMonth = localKey(payments.receivedAt, "%Y-%m");

  const latestOutcome = sql`(select "calls"."outcome" from "calls" where "calls"."lead_id" = "leads"."id" order by "calls"."called_at" desc limit 1)`;
  const [byDayOutcome, prevCalls, byAdmin, booked, prevBooked, held, cashRows, closed, prevClosed, waiting] = await Promise.all([
    db.select({ day, outcome: calls.outcome, n: count }).from(calls).where(callsIn(from, to)).groupBy(day, calls.outcome),
    db.select({ n: count }).from(calls).where(callsIn(pFrom, pTo)),
    db.select({ id: admins.id, name: admins.fullName, user: admins.username, outcome: calls.outcome, n: count })
      .from(calls).innerJoin(admins, eq(calls.adminId, admins.id)).where(callsIn(from, to)).groupBy(admins.id, calls.outcome),
    db.select({ n: count }).from(meetings).where(meetingsMade(from, to)),
    db.select({ n: count }).from(meetings).where(meetingsMade(pFrom, pTo)),
    db.select({ n: count }).from(meetings).where(and(gte(meetings.startsAt, from), lt(meetings.startsAt, to), eq(meetings.status, "completed"), adminId ? eq(meetings.adminId, adminId) : undefined)),
    db.select({ month: payMonth, cents: sql<number>`sum(${payments.amountCents})`, pkrCents: sql<number>`sum(${payments.amountCents} * ${payments.rate})` })
      .from(payments).innerJoin(projects, eq(payments.projectId, projects.id))
      .where(and(gte(payments.receivedAt, sixFrom), lt(payments.receivedAt, to), adminId ? eq(projects.ownerId, adminId) : undefined)).groupBy(payMonth),
    db.select({ n: count }).from(projects).where(projectsIn(from, to)),
    db.select({ n: count }).from(projects).where(projectsIn(pFrom, pTo)),
    // Leads still waiting for another call, right now, for the whole team
    db.select({
      followUp: sql<number>`coalesce(sum(case when ${latestOutcome} = 'follow_up' then 1 else 0 end), 0)`,
      callBack: sql<number>`coalesce(sum(case when ${latestOutcome} = 'couldnt_talk' then 1 else 0 end), 0)`,
    }).from(leads).where(NEEDS_FOLLOW_UP),
  ]);

  // Calls per day, with every day of the month present
  const dayMap = new Map<string, { connected: number; meetings: number; missed: number }>();
  for (const r of byDayOutcome) {
    const d = dayMap.get(r.day) ?? { connected: 0, meetings: 0, missed: 0 };
    const n = Number(r.n);
    if (r.outcome === "meeting_booked") d.meetings += n;
    else if (isConnected(r.outcome)) d.connected += n;
    else d.missed += n;
    dayMap.set(r.day, d);
  }
  const days = Array.from({ length: daysInMonth(ym) }, (_, i) => {
    const key = `${ym}-${String(i + 1).padStart(2, "0")}`;
    return { label: String(i + 1), ...(dayMap.get(key) ?? { connected: 0, meetings: 0, missed: 0 }) };
  });

  const outcomeTotals = OUTCOMES.map((o) => ({
    value: o.value, label: o.label,
    n: byDayOutcome.filter((r) => r.outcome === o.value).reduce((s, r) => s + Number(r.n), 0),
  }));
  const totalCalls = outcomeTotals.reduce((s, o) => s + o.n, 0);
  const connected = outcomeTotals.filter((o) => isConnected(o.value)).reduce((s, o) => s + o.n, 0);

  const adminMap = new Map<string, { id: string; name: string; calls: number; connected: number; meetings: number }>();
  for (const r of byAdmin) {
    const a = adminMap.get(r.id) ?? { id: r.id, name: r.name ?? r.user, calls: 0, connected: 0, meetings: 0 };
    const n = Number(r.n);
    a.calls += n;
    if (isConnected(r.outcome)) a.connected += n;
    if (r.outcome === "meeting_booked") a.meetings += n;
    adminMap.set(r.id, a);
  }

  const cashByMonth = new Map(cashRows.map((r) => [r.month, { cents: Number(r.cents), pkr: Number(r.pkrCents) / 100 }]));
  const cashMonths = Array.from({ length: 6 }, (_, i) => {
    const key = shiftYm(ym, i - 5);
    const v = cashByMonth.get(key) ?? { cents: 0, pkr: 0 };
    return { key, label: fmtMonthShort(key), usd: v.cents / 100, pkr: v.pkr };
  });
  const cashNow = cashMonths[5];
  const cashPrev = cashMonths[4];

  return {
    days, outcomeTotals, totalCalls, connected,
    prevCalls: Number(prevCalls[0].n),
    booked: Number(booked[0].n), prevBooked: Number(prevBooked[0].n),
    held: Number(held[0].n),
    closed: Number(closed[0].n), prevClosed: Number(prevClosed[0].n),
    cashMonths, cashNow, cashPrev,
    admins: [...adminMap.values()].sort((a, b) => b.calls - a.calls),
    followUps: { followUp: Number(waiting[0].followUp), callBack: Number(waiting[0].callBack) },
  };
}
