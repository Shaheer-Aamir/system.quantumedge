"use client";

import { useState, useTransition } from "react";
import { ghostBtn, inputClass, primaryBtn } from "@/components/form-styles";
import { OUTCOMES } from "@/lib/outcomes";
import { msToLocalInput } from "@/lib/time";
import type { LeadRow } from "../leads/lead-detail";
import { deleteCallAction, updateCallAction } from "./actions";

export type CallRowData = {
  id: string; calledAt: number; outcome: string; notes: string | null;
  adminId: string; adminName: string; adminAvatar: string | null;
  canManage: boolean; linkedMeetings: number; scheduledMeetings: number;
  lead: LeadRow;
};

// Edit a logged call, or remove it if it should never have been logged.
export function CallEditForm({ row, onDone }: { row: CallRowData; onDone: () => void }) {
  const [outcome, setOutcome] = useState(row.outcome);
  const [notes, setNotes] = useState(row.notes ?? "");
  const [calledAt, setCalledAt] = useState(msToLocalInput(row.calledAt));
  const [meetingAt, setMeetingAt] = useState("");
  const [meetingTitle, setMeetingTitle] = useState("Intro call");
  const [meetingDuration, setMeetingDuration] = useState(30);
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  const name = row.lead.company || row.lead.contactName || "this lead";

  const needsMeeting = outcome === "meeting_booked" && row.linkedMeetings === 0;
  const dropsMeeting = outcome !== "meeting_booked" && row.outcome === "meeting_booked" && row.scheduledMeetings > 0;
  const onlyCall = row.lead.callCount <= 1;

  function save() {
    setError("");
    start(async () => {
      const r = await updateCallAction(row.id, { outcome, notes, calledAt, meetingAt: needsMeeting ? meetingAt : undefined, meetingTitle, meetingDuration });
      if (r.error) setError(r.error); else onDone();
    });
  }
  function remove() {
    const extra = row.scheduledMeetings > 0 ? " The meeting booked from this call is removed too." : "";
    const lead = onlyCall ? ` ${name} goes back to New, as if it was never called.` : "";
    if (!window.confirm(`Delete this call?${lead}${extra}`)) return;
    setError("");
    start(async () => { const r = await deleteCallAction(row.id); if (r.error) setError(r.error); else onDone(); });
  }

  return (
    <div className="space-y-5">
      <p className="text-sm text-muted">Call with <strong className="text-fg">{name}</strong></p>

      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">How did the call go?</legend>
        <div className="flex flex-wrap gap-2">
          {OUTCOMES.map((o) => (
            <button key={o.value} type="button" onClick={() => setOutcome(o.value)} aria-pressed={outcome === o.value}
              className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-sm transition focus-visible:outline-2 focus-visible:outline-ice ${outcome === o.value ? "border-ice bg-accent/20 text-fg" : "border-line text-muted hover:text-fg"}`}>
              <i className={`bi ${o.icon}`} aria-hidden="true" /> {o.label}
            </button>
          ))}
        </div>
      </fieldset>

      {needsMeeting && (
        <div className="grid gap-4 rounded-xl border border-line bg-surface/50 p-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <label htmlFor="ce-at" className="text-sm font-medium">Meeting date and time</label>
            <input id="ce-at" type="datetime-local" value={meetingAt} onChange={(e) => setMeetingAt(e.target.value)} className={inputClass} />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="ce-len" className="text-sm font-medium">Length</label>
            <select id="ce-len" value={meetingDuration} onChange={(e) => setMeetingDuration(Number(e.target.value))} className={inputClass}>
              {[15, 30, 45, 60, 90].map((m) => <option key={m} value={m}>{m} minutes</option>)}
            </select>
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <label htmlFor="ce-title" className="text-sm font-medium">Meeting title</label>
            <input id="ce-title" value={meetingTitle} onChange={(e) => setMeetingTitle(e.target.value)} className={inputClass} />
          </div>
        </div>
      )}
      {dropsMeeting && <p className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm">The meeting booked from this call will be removed from the calendar when you save.</p>}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5 sm:col-span-2">
          <label htmlFor="ce-notes" className="text-sm font-medium">Notes</label>
          <textarea id="ce-notes" rows={3} maxLength={1000} value={notes} onChange={(e) => setNotes(e.target.value)} className={inputClass} />
        </div>
        <div className="space-y-1.5">
          <label htmlFor="ce-time" className="text-sm font-medium">Call time</label>
          <input id="ce-time" type="datetime-local" value={calledAt} onChange={(e) => setCalledAt(e.target.value)} className={inputClass} />
        </div>
      </div>

      {error && <p role="alert" className="text-sm text-red-600 dark:text-red-300">{error}</p>}

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
        <div>
          <button type="button" onClick={remove} disabled={pending} className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm text-red-600 transition hover:bg-red-500/10 dark:text-red-300">
            <i className="bi bi-trash3" aria-hidden="true" /> Logged by mistake? Delete this call
          </button>
          <p className="px-3 text-xs text-muted">{onlyCall ? "This was the only call, so the lead goes back to New." : "The lead keeps its other calls."}</p>
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={onDone} className={ghostBtn}>Cancel</button>
          <button type="button" onClick={save} disabled={pending} className={primaryBtn}>{pending ? "Saving" : "Save changes"}</button>
        </div>
      </div>
    </div>
  );
}
