export const OUTCOMES = [
  { value: "no_answer", label: "No answer", icon: "bi-telephone-x", tone: "bg-slate-500/15 text-slate-600 dark:text-slate-300" },
  { value: "failed", label: "Failed call", icon: "bi-x-octagon", tone: "bg-red-500/10 text-red-600 dark:text-red-300" },
  { value: "couldnt_talk", label: "Connected, couldn't talk", icon: "bi-telephone-forward", tone: "bg-cyan-500/10 text-cyan-700 dark:text-cyan-300" },
  { value: "not_interested", label: "Not interested", icon: "bi-hand-thumbs-down", tone: "bg-amber-500/10 text-amber-700 dark:text-amber-300" },
  { value: "follow_up", label: "Follow up", icon: "bi-clock-history", tone: "bg-sky-500/10 text-sky-700 dark:text-ice" },
  { value: "meeting_booked", label: "Meeting booked", icon: "bi-calendar-check", tone: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300" },
] as const;
export type Outcome = (typeof OUTCOMES)[number]["value"];
export const OUTCOME_VALUES = OUTCOMES.map((o) => o.value) as string[];
export const outcomeMeta = (v: string) => OUTCOMES.find((o) => o.value === v) ?? OUTCOMES[0];
// A call counts as "connected" when someone picked up, even if they had no time to talk.
export const isConnected = (v: string) => v !== "no_answer" && v !== "failed";
// These leave the lead waiting for another call.
export const FOLLOW_UP_OUTCOMES = ["follow_up", "couldnt_talk"] as const;
export const needsFollowUp = (v: string | null) => v === "follow_up" || v === "couldnt_talk";

export const MEETING_STATUSES = [
  { value: "scheduled", label: "Scheduled", chip: "bg-accent/25 text-fg", tone: "bg-accent/15 text-fg" },
  { value: "completed", label: "Completed", chip: "bg-emerald-500/20 text-emerald-700 dark:text-emerald-300", tone: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300" },
  { value: "no_show", label: "No show", chip: "bg-red-500/15 text-red-600 dark:text-red-300", tone: "bg-red-500/10 text-red-600 dark:text-red-300" },
  { value: "cancelled", label: "Cancelled", chip: "bg-slate-500/15 text-muted line-through", tone: "bg-slate-500/15 text-slate-600 dark:text-slate-300" },
] as const;
export type MeetingStatus = (typeof MEETING_STATUSES)[number]["value"];
export const MEETING_STATUS_VALUES = MEETING_STATUSES.map((s) => s.value) as string[];
export const statusMeta = (v: string) => MEETING_STATUSES.find((s) => s.value === v) ?? MEETING_STATUSES[0];
