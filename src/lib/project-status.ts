export const PROJECT_STATUSES = [
  { value: "ongoing", label: "Ongoing", tone: "bg-sky-500/10 text-sky-700 dark:text-ice" },
  { value: "completed", label: "Completed", tone: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300" },
  { value: "on_hold", label: "On hold", tone: "bg-amber-500/10 text-amber-700 dark:text-amber-300" },
  { value: "cancelled", label: "Cancelled", tone: "bg-slate-500/15 text-slate-600 dark:text-slate-300" },
] as const;
export type ProjectStatus = (typeof PROJECT_STATUSES)[number]["value"];
export const PROJECT_STATUS_VALUES = PROJECT_STATUSES.map((s) => s.value) as string[];
export const projectStatusMeta = (v: string) => PROJECT_STATUSES.find((s) => s.value === v) ?? PROJECT_STATUSES[0];
