"use client";

import { useActionState, useEffect, useState } from "react";
import { logCallAction, type CallState } from "@/app/(app)/calls/actions";
import type { LeadHit } from "@/lib/lead-hit";
import { OUTCOMES } from "@/lib/outcomes";
import { msToLocalInput } from "@/lib/time";
import { inputClass, primaryBtn } from "./form-styles";
import { LeadPicker } from "./lead-picker";

export function CallForm({ onDone, preselected }: { onDone: () => void; preselected?: LeadHit | null }) {
  const [state, action, pending] = useActionState<CallState, FormData>(logCallAction, {});
  const [outcome, setOutcome] = useState<string>("no_answer");
  const [now] = useState(() => msToLocalInput(Date.now()));

  useEffect(() => {
    if (state.ok) onDone();
  }, [state, onDone]);

  return (
    <form action={action} className="space-y-5">
      <LeadPicker preselected={preselected} />

      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">How did the call go?</legend>
        <div className="flex flex-wrap gap-2">
          {OUTCOMES.map((o) => (
            <button key={o.value} type="button" onClick={() => setOutcome(o.value)} aria-pressed={outcome === o.value}
              className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-sm transition focus-visible:outline-2 focus-visible:outline-ice ${
                outcome === o.value ? "border-ice bg-accent/20 text-fg" : "border-line text-muted hover:text-fg"
              }`}>
              <i className={`bi ${o.icon}`} aria-hidden="true" /> {o.label}
            </button>
          ))}
        </div>
        <input type="hidden" name="outcome" value={outcome} />
      </fieldset>

      {outcome === "meeting_booked" && (
        <div className="grid gap-4 rounded-xl border border-line bg-surface/50 p-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <label htmlFor="meetingAt" className="text-sm font-medium">Meeting date and time</label>
            <input id="meetingAt" name="meetingAt" type="datetime-local" required className={inputClass} />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="meetingDuration" className="text-sm font-medium">Length</label>
            <select id="meetingDuration" name="meetingDuration" defaultValue="30" className={inputClass}>
              {[15, 30, 45, 60, 90].map((m) => <option key={m} value={m}>{m} minutes</option>)}
            </select>
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <label htmlFor="meetingTitle" className="text-sm font-medium">Meeting title</label>
            <input id="meetingTitle" name="meetingTitle" defaultValue="Intro call" className={inputClass} />
          </div>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5 sm:col-span-2">
          <label htmlFor="notes" className="text-sm font-medium">Notes <span className="font-normal text-muted">(optional)</span></label>
          <textarea id="notes" name="notes" rows={3} maxLength={1000} className={inputClass} />
        </div>
        <div className="space-y-1.5">
          <label htmlFor="calledAt" className="text-sm font-medium">Call time</label>
          <input id="calledAt" name="calledAt" type="datetime-local" defaultValue={now} required className={inputClass} />
        </div>
      </div>

      {state.error && (
        <p role="alert" className="flex items-center gap-2 rounded-xl border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm text-red-600 dark:text-red-300">
          <i className="bi bi-exclamation-circle" aria-hidden="true" /> {state.error}
        </p>
      )}

      <button type="submit" disabled={pending} className={`${primaryBtn} w-full`}>
        {pending ? <><i className="bi bi-arrow-repeat animate-spin" aria-hidden="true" /> Saving</> : "Save call"}
      </button>
    </form>
  );
}
