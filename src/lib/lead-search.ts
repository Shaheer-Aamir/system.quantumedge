import { desc, eq, or, sql } from "drizzle-orm";
import { leads } from "@/db/schema";
import type { LeadHit } from "./lead-hit";
import { normalizePhone } from "./phone";
import type { Db } from "@/db/types";



// The table names are written out in full on purpose: in a query with a single table the column helpers
// drop the table prefix, which makes "id" ambiguous inside these subqueries.
const hitFields = {
  id: leads.id, company: leads.company, contactName: leads.contactName, phone: leads.phone, email: leads.email, status: leads.status,
  callCount: sql<number>`(select count(*) from "calls" where "calls"."lead_id" = "leads"."id")`,
  lastOutcome: sql<string | null>`(select "calls"."outcome" from "calls" where "calls"."lead_id" = "leads"."id" order by "calls"."called_at" desc limit 1)`,
  lastCalledAt: sql<number | null>`(select max("calls"."called_at") from "calls" where "calls"."lead_id" = "leads"."id")`,
};

const toHit = (r: { id: string; company: string | null; contactName: string | null; phone: string | null; email: string | null; status: string; callCount: number; lastOutcome: string | null; lastCalledAt: number | null }): LeadHit => ({
  ...r, callCount: Number(r.callCount), lastCalledAt: r.lastCalledAt === null ? null : Number(r.lastCalledAt),
});

// Matches company, contact name, email and phone. Names that start with the typed text come first.
export async function searchLeads(db: Db, rawTerm: string, limit = 8): Promise<LeadHit[]> {
  const term = rawTerm.replace(/[%_\\]/g, " ").trim().slice(0, 60).toLowerCase();
  if (term.length < 2) return [];
  const digits = normalizePhone(term);
  const contains = `%${term}%`;
  const prefix = `${term}%`;

  const rows = await db
    .select(hitFields)
    .from(leads)
    .where(or(
      sql`lower(coalesce(${leads.company}, '')) like ${contains}`,
      sql`lower(coalesce(${leads.contactName}, '')) like ${contains}`,
      sql`lower(coalesce(${leads.email}, '')) like ${contains}`,
      sql`coalesce(${leads.phone}, '') like ${contains}`,
      digits.length >= 3 ? sql`coalesce(${leads.phoneNormalized}, '') like ${`%${digits}%`}` : undefined,
    ))
    .orderBy(
      sql`case when lower(coalesce(${leads.company}, '')) like ${prefix} then 0 when lower(coalesce(${leads.contactName}, '')) like ${prefix} then 1 else 2 end`,
      desc(leads.updatedAt),
    )
    .limit(limit);
  return rows.map(toHit);
}

export async function getLeadHit(db: Db, id: string): Promise<LeadHit | null> {
  const rows = await db.select(hitFields).from(leads).where(eq(leads.id, id)).limit(1);
  return rows[0] ? toHit(rows[0]) : null;
}
