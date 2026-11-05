import { eq } from "drizzle-orm";
import type { Db } from "@/db/types";
import { leads } from "@/db/schema";


import { EMAIL_RE, PHONE_RE, normalizePhone } from "./phone";
export { EMAIL_RE, PHONE_RE, normalizePhone };

export type LeadInput = { company: string; contactName: string; phone: string; email: string };

export function readLeadInput(formData: FormData): LeadInput {
  const get = (k: string) => String(formData.get(k) ?? "").trim();
  return { company: get("company"), contactName: get("contactName"), phone: get("phone"), email: get("email") };
}

export function validateLead(l: LeadInput): string | null {
  if (!l.company && !l.contactName) return "Enter a company or a contact name.";
  if (l.company.length > 120 || l.contactName.length > 120) return "Names must be under 120 characters.";
  if (!PHONE_RE.test(l.phone)) return "Enter a valid phone number, for example +1 415 555 0123.";
  if (l.email && !EMAIL_RE.test(l.email)) return "Enter a valid email address.";
  return null;
}

// Reuses a lead with the same phone number, otherwise creates one.
export async function findOrCreateLead(db: Db, adminId: string, input: LeadInput) {
  const phoneNormalized = normalizePhone(input.phone);
  const existing = await db.query.leads.findFirst({ where: eq(leads.phoneNormalized, phoneNormalized) });
  const now = Date.now();
  if (existing) {
    const fill = {
      company: existing.company || input.company || null,
      contactName: existing.contactName || input.contactName || null,
      email: existing.email || input.email || null,
      updatedAt: now,
    };
    await db.update(leads).set(fill).where(eq(leads.id, existing.id));
    return { id: existing.id, status: existing.status };
  }
  const id = crypto.randomUUID();
  await db.insert(leads).values({
    id,
    company: input.company || null,
    contactName: input.contactName || null,
    phone: input.phone,
    phoneNormalized,
    email: input.email || null,
    status: "new",
    source: "manual",
    createdBy: adminId,
    createdAt: now,
    updatedAt: now,
  });
  return { id, status: "new" as const };
}

// Used by the call and meeting forms. A lead chosen from the suggestions arrives as leadId.
// Otherwise the typed details are validated and matched on phone number, or a new lead is created.
export async function resolveLead(db: Db, adminId: string, formData: FormData): Promise<{ id: string; status: string } | { error: string }> {
  const leadId = String(formData.get("leadId") ?? "").trim();
  if (leadId) {
    const lead = await db.query.leads.findFirst({ where: eq(leads.id, leadId) });
    if (!lead) return { error: "That lead no longer exists. Clear the selection and try again." };
    return { id: lead.id, status: lead.status };
  }
  const input = readLeadInput(formData);
  const problem = validateLead(input);
  if (problem) return { error: problem };
  return findOrCreateLead(db, adminId, input);
}
