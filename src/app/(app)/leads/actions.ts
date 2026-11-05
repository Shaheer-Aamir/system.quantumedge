"use server";

import { revalidatePath } from "next/cache";
import { desc, eq, inArray } from "drizzle-orm";
import { getDb } from "@/db";
import { admins, calls, leads, meetings } from "@/db/schema";
import { requireAdmin, requireSuperAdmin } from "@/lib/auth";
import { chunk } from "@/lib/chunk";
import { importLeadRows, type ImportResult, type ImportRow } from "@/lib/lead-import";
import { LEAD_STATUS_VALUES, type LeadStatus } from "@/lib/lead-status";
import { normalizePhone, readLeadInput, validateLead } from "@/lib/leads";
import { listAdmins } from "@/lib/queries";

async function adminIds() {
  return (await listAdmins()).map((a) => a.id);
}

// ---- import -------------------------------------------------------------

export async function importLeadsBatchAction(rows: ImportRow[]): Promise<ImportResult & { error?: string }> {
  const admin = await requireAdmin();
  if (!Array.isArray(rows) || rows.length === 0 || rows.length > 120) {
    return { imported: 0, duplicates: 0, invalid: 0, invalidRows: [], error: "Invalid import batch." };
  }
  const result = await importLeadRows(getDb(), admin.id, rows, await adminIds());
  revalidatePath("/leads");
  return result;
}

// ---- single lead --------------------------------------------------------

export type LeadFormState = { error?: string; ok?: boolean };

export async function createLeadAction(_prev: LeadFormState, formData: FormData): Promise<LeadFormState> {
  const admin = await requireAdmin();
  const input = readLeadInput(formData);
  const problem = validateLead(input);
  if (problem) return { error: problem };

  const db = getDb();
  const phoneNormalized = normalizePhone(input.phone);
  if (await db.query.leads.findFirst({ where: eq(leads.phoneNormalized, phoneNormalized) })) {
    return { error: "A lead with this phone number already exists." };
  }
  const assigned = String(formData.get("assignedTo") ?? "");
  const now = Date.now();
  await db.insert(leads).values({
    id: crypto.randomUUID(), company: input.company || null, contactName: input.contactName || null,
    phone: input.phone, phoneNormalized, email: input.email || null, status: "new",
    notes: String(formData.get("notes") ?? "").trim().slice(0, 1000) || null, extra: null,
    assignedTo: (await adminIds()).includes(assigned) ? assigned : null,
    source: "manual", createdBy: admin.id, createdAt: now, updatedAt: now,
  });
  revalidatePath("/leads");
  return { ok: true };
}

export async function updateLeadAction(
  id: string,
  data: { company: string; contactName: string; phone: string; email: string; status: string; assignedTo: string; notes: string },
): Promise<{ error?: string }> {
  await requireAdmin();
  const input = { company: data.company.trim(), contactName: data.contactName.trim(), phone: data.phone.trim(), email: data.email.trim() };
  const problem = validateLead(input);
  if (problem) return { error: problem };
  if (!LEAD_STATUS_VALUES.includes(data.status)) return { error: "Unknown status." };

  const db = getDb();
  const phoneNormalized = normalizePhone(input.phone);
  const clash = await db.query.leads.findFirst({ where: eq(leads.phoneNormalized, phoneNormalized) });
  if (clash && clash.id !== id) return { error: "Another lead already uses this phone number." };

  await db.update(leads).set({
    company: input.company || null, contactName: input.contactName || null, phone: input.phone, phoneNormalized,
    email: input.email || null, status: data.status as LeadStatus,
    assignedTo: (await adminIds()).includes(data.assignedTo) ? data.assignedTo : null,
    notes: data.notes.trim().slice(0, 1000) || null, updatedAt: Date.now(),
  }).where(eq(leads.id, id));
  revalidatePath("/leads");
  return {};
}

export async function getLeadHistoryAction(id: string) {
  await requireAdmin();
  const db = getDb();
  const callRows = await db
    .select({ id: calls.id, outcome: calls.outcome, notes: calls.notes, calledAt: calls.calledAt, name: admins.fullName, user: admins.username })
    .from(calls).innerJoin(admins, eq(calls.adminId, admins.id))
    .where(eq(calls.leadId, id)).orderBy(desc(calls.calledAt)).limit(30);
  const meetingRows = await db
    .select({ id: meetings.id, title: meetings.title, startsAt: meetings.startsAt, status: meetings.status })
    .from(meetings).where(eq(meetings.leadId, id)).orderBy(desc(meetings.startsAt)).limit(10);
  return {
    calls: callRows.map((c) => ({ id: c.id, outcome: c.outcome, notes: c.notes, calledAt: c.calledAt, admin: c.name ?? c.user })),
    meetings: meetingRows,
  };
}

// ---- bulk ---------------------------------------------------------------

const cleanIds = (ids: string[]) => (Array.isArray(ids) ? ids.filter((i) => typeof i === "string").slice(0, 500) : []);

export async function bulkUpdateLeadsAction(ids: string[], patch: { status?: string; assignedTo?: string }): Promise<{ error?: string }> {
  await requireAdmin();
  const list = cleanIds(ids);
  if (!list.length) return {};
  const set: { updatedAt: number; status?: LeadStatus; assignedTo?: string | null } = { updatedAt: Date.now() };
  if (patch.status !== undefined) {
    if (!LEAD_STATUS_VALUES.includes(patch.status)) return { error: "Unknown status." };
    set.status = patch.status as LeadStatus;
  }
  if (patch.assignedTo !== undefined) {
    set.assignedTo = patch.assignedTo === "" ? null : (await adminIds()).includes(patch.assignedTo) ? patch.assignedTo : null;
  }
  const db = getDb();
  for (const part of chunk(list, 90)) await db.update(leads).set(set).where(inArray(leads.id, part));
  revalidatePath("/leads");
  return {};
}

export async function deleteLeadsAction(ids: string[]): Promise<{ error?: string }> {
  await requireSuperAdmin();
  const list = cleanIds(ids);
  const db = getDb();
  for (const part of chunk(list, 90)) await db.delete(leads).where(inArray(leads.id, part));
  revalidatePath("/leads");
  revalidatePath("/calls");
  revalidatePath("/calendar");
  return {};
}
