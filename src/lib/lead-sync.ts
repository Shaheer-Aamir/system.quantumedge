import { and, count, eq, inArray } from "drizzle-orm";
import { calls, leads, meetings } from "@/db/schema";
import type { Db } from "@/db/types";

// Keeps a lead's status honest after a call or meeting is deleted or changed:
//   any live meeting -> Meeting booked, any call -> Contacted, nothing -> New.
// Leads marked Dead or Closed are left exactly as they are, because someone chose that.
export async function syncLeadStatus(db: Db, leadId: string) {
  const lead = await db.query.leads.findFirst({ where: eq(leads.id, leadId) });
  if (!lead || !["new", "contacted", "meeting_booked"].includes(lead.status)) return lead?.status ?? null;

  const [{ n: callCount }] = await db.select({ n: count() }).from(calls).where(eq(calls.leadId, leadId));
  const [{ n: meetingCount }] = await db.select({ n: count() }).from(meetings)
    .where(and(eq(meetings.leadId, leadId), inArray(meetings.status, ["scheduled", "completed"])));

  const next = meetingCount > 0 ? "meeting_booked" : callCount > 0 ? "contacted" : "new";
  if (next !== lead.status) await db.update(leads).set({ status: next, updatedAt: Date.now() }).where(eq(leads.id, leadId));
  return next;
}
