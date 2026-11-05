"use client";

import { useActionState, useEffect } from "react";
import { createMeetingAction, type MeetingState } from "@/app/(app)/calendar/actions";
import type { LeadHit } from "@/lib/lead-hit";
import { inputClass, primaryBtn } from "./form-styles";
import { LeadPicker } from "./lead-picker";

export function MeetingForm({ onDone, preselected }: { onDone: () => void; preselected?: LeadHit | null }) {
  const [state, action, pending] = useActionState<MeetingState, FormData>(createMeetingAction, {});
  useEffect(() => { if (state.ok) onDone(); }, [state, onDone]);
  return (
    <form action={action} className="space-y-5">
      <LeadPicker preselected={preselected} />
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <label htmlFor="meetingAt" className="text-sm font-medium">Date and time</label>
          <input id="meetingAt" name="meetingAt" type="datetime-local" required className={inputClass} />
        </div>
        <div className="space-y-1.5">
          <label htmlFor="meetingDuration" className="text-sm font-medium">Length</label>
          <select id="meetingDuration" name="meetingDuration" defaultValue="30" className={inputClass}>
            {[15, 30, 45, 60, 90].map((m) => <option key={m} value={m}>{m} minutes</option>)}
          </select>
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <label htmlFor="meetingTitle" className="text-sm font-medium">Title</label>
          <input id="meetingTitle" name="meetingTitle" defaultValue="Intro call" className={inputClass} />
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <label htmlFor="notes" className="text-sm font-medium">Notes <span className="font-normal text-muted">(optional)</span></label>
          <textarea id="notes" name="notes" rows={3} maxLength={1000} className={inputClass} />
        </div>
      </div>
      {state.error && (
        <p role="alert" className="flex items-center gap-2 rounded-xl border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm text-red-600 dark:text-red-300">
          <i className="bi bi-exclamation-circle" aria-hidden="true" /> {state.error}
        </p>
      )}
      <button type="submit" disabled={pending} className={`${primaryBtn} w-full`}>
        {pending ? <><i className="bi bi-arrow-repeat animate-spin" aria-hidden="true" /> Saving</> : "Save meeting"}
      </button>
    </form>
  );
}
