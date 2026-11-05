export const LEAD_STATUSES = [
  { value: "new", label: "New", tone: "bg-slate-500/15 text-slate-600 dark:text-slate-300" },
  { value: "contacted", label: "Contacted", tone: "bg-sky-500/10 text-sky-700 dark:text-ice" },
  { value: "meeting_booked", label: "Meeting booked", tone: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300" },
  { value: "closed", label: "Closed", tone: "bg-violet-500/15 text-violet-700 dark:text-violet-300" },
  { value: "dead", label: "Dead", tone: "bg-red-500/10 text-red-600 dark:text-red-300" },
] as const;
export type LeadStatus = (typeof LEAD_STATUSES)[number]["value"];
export const LEAD_STATUS_VALUES = LEAD_STATUSES.map((s) => s.value) as string[];
export const leadStatusMeta = (v: string) => LEAD_STATUSES.find((s) => s.value === v) ?? LEAD_STATUSES[0];
