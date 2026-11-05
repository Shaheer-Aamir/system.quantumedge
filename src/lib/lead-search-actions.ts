"use server";

import { getDb } from "@/db";
import { requireAdmin } from "@/lib/auth";
import type { LeadHit } from "@/lib/lead-hit";
import { searchLeads } from "@/lib/lead-search";

export async function searchLeadsAction(term: string): Promise<LeadHit[]> {
  await requireAdmin();
  return searchLeads(getDb(), String(term ?? ""), 8);
}
