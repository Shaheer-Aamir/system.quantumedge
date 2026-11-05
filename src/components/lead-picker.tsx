"use client";

import type { LeadHit } from "@/lib/lead-hit";
import { searchLeadsAction } from "@/lib/lead-search-actions";
import { LeadPickerView } from "./lead-picker-view";

export function LeadPicker({ preselected }: { preselected?: LeadHit | null }) {
  return <LeadPickerView search={searchLeadsAction} preselected={preselected} />;
}
