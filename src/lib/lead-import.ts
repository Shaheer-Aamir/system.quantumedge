import { inArray } from "drizzle-orm";
import { leads } from "@/db/schema";
import { chunk } from "./chunk";
import { EMAIL_RE, PHONE_RE, normalizePhone } from "./phone";
import type { Db } from "@/db/types";



export type ImportRow = {
  n: number; // spreadsheet row number, used to report problems
  company: string;
  contactName: string;
  phone: string;
  email: string;
  notes: string;
  extra: Record<string, string>;
  assignTo: string; // admin id or ""
};

export type ImportResult = { imported: number; duplicates: number; invalid: number; invalidRows: number[] };

const clip = (v: unknown, max: number) => String(v ?? "").trim().slice(0, max);

export async function importLeadRows(db: Db, adminId: string, rows: ImportRow[], validAdminIds: string[]): Promise<ImportResult> {
  const result: ImportResult = { imported: 0, duplicates: 0, invalid: 0, invalidRows: [] };
  const seen = new Set<string>();
  const candidates: (typeof leads.$inferInsert)[] = [];
  const now = Date.now();

  for (const r of rows) {
    const company = clip(r.company, 120);
    const contactName = clip(r.contactName, 120);
    const phone = clip(r.phone, 30);
    const phoneNormalized = normalizePhone(phone);
    if ((!company && !contactName) || !PHONE_RE.test(phone) || phoneNormalized.length < 6) {
      result.invalid++;
      if (result.invalidRows.length < 20) result.invalidRows.push(Number(r.n) || 0);
      continue;
    }
    if (seen.has(phoneNormalized)) { result.duplicates++; continue; }
    seen.add(phoneNormalized);

    const email = clip(r.email, 160);
    const extraEntries = Object.entries(r.extra ?? {}).slice(0, 20).map(([k, v]) => [clip(k, 60), clip(v, 300)] as const).filter(([k, v]) => k && v);
    candidates.push({
      id: crypto.randomUUID(),
      company: company || null,
      contactName: contactName || null,
      phone,
      phoneNormalized,
      email: EMAIL_RE.test(email) ? email : null,
      status: "new",
      notes: clip(r.notes, 1000) || null,
      extra: extraEntries.length ? JSON.stringify(Object.fromEntries(extraEntries)) : null,
      assignedTo: validAdminIds.includes(r.assignTo) ? r.assignTo : null,
      source: "import",
      createdBy: adminId,
      createdAt: now,
      updatedAt: now,
    });
  }

  // Drop numbers that are already in the database.
  const existing = new Set<string>();
  for (const part of chunk(candidates.map((c) => c.phoneNormalized as string), 90)) {
    const found = await db.select({ p: leads.phoneNormalized }).from(leads).where(inArray(leads.phoneNormalized, part));
    for (const f of found) if (f.p) existing.add(f.p);
  }
  const fresh = candidates.filter((c) => !existing.has(c.phoneNormalized as string));
  result.duplicates += candidates.length - fresh.length;

  // 14 columns per row and a 100 parameter limit means 5 rows per statement.
  const statements = chunk(fresh, 5).map((part) => db.insert(leads).values(part));
  if (statements.length) {
    await db.batch(statements as unknown as [(typeof statements)[number], ...(typeof statements)[number][]]);
  }
  result.imported = fresh.length;
  return result;
}
