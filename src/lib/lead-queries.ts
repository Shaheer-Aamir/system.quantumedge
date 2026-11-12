import { and, asc, desc, eq, gte, isNull, like, lt, or, sql, type SQL } from "drizzle-orm";
import { admins, calls, leads } from "@/db/schema";
import { LEAD_STATUS_VALUES } from "./lead-status";
import { normalizePhone } from "./phone";
import { TZ_OFFSET_MS, dayRange, isYmd } from "./time";
import type { Db } from "@/db/types";



export const PAGE_SIZES = [25, 50, 100] as const;
export const SORTS = [
  { value: "newest", label: "Newest first" },
  { value: "oldest", label: "Oldest first" },
  { value: "company", label: "Company A to Z" },
  { value: "last_called", label: "Recently called" },
  { value: "waiting", label: "Waiting longest" },
  { value: "most_calls", label: "Most calls" },
] as const;

// date is the day (Pakistan time) the lead was added or imported, as YYYY-MM-DD. Empty means all leads.
// followup: only leads whose most recent call left them waiting for another call
export type LeadFilters = { q: string; status: string; assigned: string; sort: string; page: number; date: string; size: number; followup: boolean };

const callCount = sql<number>`(select count(*) from ${calls} where ${calls.leadId} = ${leads.id})`;
// Written with full table names so it works inside any query. True when the lead still needs another call.
export const NEEDS_FOLLOW_UP = sql`("leads"."status" in ('new', 'contacted') and (select "calls"."outcome" from "calls" where "calls"."lead_id" = "leads"."id" order by "calls"."called_at" desc limit 1) in ('follow_up', 'couldnt_talk'))`;
const lastOutcome = sql<string | null>`(select "calls"."outcome" from "calls" where "calls"."lead_id" = "leads"."id" order by "calls"."called_at" desc limit 1)`;
const lastCalled = sql<number | null>`(select max(${calls.calledAt}) from ${calls} where ${calls.leadId} = ${leads.id})`;

export function parseFilters(sp: Record<string, string | undefined>, adminIds: string[]): LeadFilters {
  return {
    q: (sp.q ?? "").trim().slice(0, 80),
    status: LEAD_STATUS_VALUES.includes(sp.status ?? "") ? sp.status! : "",
    assigned: sp.assigned === "none" || adminIds.includes(sp.assigned ?? "") ? sp.assigned! : "",
    sort: SORTS.some((s) => s.value === sp.sort) ? sp.sort! : "newest",
    page: Math.max(1, Math.floor(Number(sp.page)) || 1),
    date: isYmd(sp.date) ? sp.date : "",
    followup: sp.followup === "1",
    size: (PAGE_SIZES as readonly number[]).includes(Number(sp.size)) ? Number(sp.size) : PAGE_SIZES[0],
  };
}

function where(f: LeadFilters) {
  const parts: (SQL | undefined)[] = [];
  if (f.q) {
    const term = `%${f.q.replace(/[%_]/g, "")}%`;
    const digits = normalizePhone(f.q);
    parts.push(or(
      like(leads.company, term), like(leads.contactName, term), like(leads.email, term), like(leads.phone, term),
      digits.length >= 3 ? like(leads.phoneNormalized, `%${digits}%`) : undefined,
    ));
  }
  if (f.date) {
    const [start, end] = dayRange(f.date);
    parts.push(gte(leads.createdAt, start), lt(leads.createdAt, end));
  }
  if (f.followup) parts.push(NEEDS_FOLLOW_UP);
  if (f.status) parts.push(eq(leads.status, f.status as "new"));
  if (f.assigned === "none") parts.push(isNull(leads.assignedTo));
  else if (f.assigned) parts.push(eq(leads.assignedTo, f.assigned));
  return and(...parts);
}

export async function queryLeads(db: Db, f: LeadFilters) {
  const order = {
    newest: [desc(leads.createdAt)],
    oldest: [asc(leads.createdAt)],
    company: [asc(sql`lower(coalesce(${leads.company}, ${leads.contactName}, ''))`)],
    last_called: [desc(sql`coalesce(${lastCalled}, 0)`), desc(leads.createdAt)],
    waiting: [asc(sql`coalesce(${lastCalled}, 0)`), desc(leads.createdAt)],
    most_calls: [desc(callCount), desc(leads.createdAt)],
  }[f.sort] ?? [desc(leads.createdAt)];

  const [{ total }] = await db.select({ total: sql<number>`count(*)` }).from(leads).where(where(f));
  const rows = await db
    .select({ lead: leads, assignedName: admins.fullName, assignedUser: admins.username, callCount, lastCalled, lastOutcome })
    .from(leads)
    .leftJoin(admins, eq(leads.assignedTo, admins.id))
    .where(where(f))
    .orderBy(...order)
    .limit(f.size)
    .offset((f.page - 1) * f.size);
  return { total: Number(total), rows };
}

// Status totals for the stat cards. With a date, only that day's leads are counted.
export async function leadStatusCounts(db: Db, date = "") {
  const [start, end] = date ? dayRange(date) : [undefined, undefined];
  const rows = await db.select({ status: leads.status, n: sql<number>`count(*)` }).from(leads)
    .where(start === undefined ? undefined : and(gte(leads.createdAt, start), lt(leads.createdAt, end!)))
    .groupBy(leads.status);
  return Object.fromEntries(rows.map((r) => [r.status, Number(r.n)])) as Record<string, number>;
}

// How many leads were added on each of the given days (YYYY-MM-DD, Pakistan time).
export async function leadCountsByDay(db: Db, days: string[]) {
  const ranges = days.map(dayRange);
  const key = sql<string>`strftime('%Y-%m-%d', (${leads.createdAt} + ${sql.raw(String(TZ_OFFSET_MS))}) / 1000, 'unixepoch')`;
  const rows = await db.select({ day: key, n: sql<number>`count(*)` }).from(leads)
    .where(and(gte(leads.createdAt, Math.min(...ranges.map((r) => r[0]))), lt(leads.createdAt, Math.max(...ranges.map((r) => r[1])))))
    .groupBy(key);
  const out: Record<string, number> = Object.fromEntries(days.map((d) => [d, 0]));
  for (const r of rows) if (r.day in out) out[r.day] = Number(r.n);
  return out;
}

// How many leads are waiting for a follow-up call right now.
export async function followUpCount(db: Db) {
  const [row] = await db.select({ n: sql<number>`count(*)` }).from(leads).where(NEEDS_FOLLOW_UP);
  return Number(row.n);
}
