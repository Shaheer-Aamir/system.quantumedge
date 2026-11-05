"use client";

import { useActionState, useEffect, useState } from "react";
import { Modal } from "@/components/modal";
import { LeadFields } from "@/components/lead-fields";
import { ghostBtn, inputClass, primaryBtn } from "@/components/form-styles";
import { createLeadAction, type LeadFormState } from "./actions";

function Form({ people, onDone }: { people: { id: string; name: string }[]; onDone: () => void }) {
  const [state, action, pending] = useActionState<LeadFormState, FormData>(createLeadAction, {});
  useEffect(() => { if (state.ok) onDone(); }, [state, onDone]);
  return (
    <form action={action} className="space-y-5">
      <LeadFields />
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <label htmlFor="assignedTo" className="text-sm font-medium">Assigned to</label>
          <select id="assignedTo" name="assignedTo" defaultValue="" className={inputClass}>
            <option value="">Unassigned</option>
            {people.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <label htmlFor="notes" className="text-sm font-medium">Notes <span className="font-normal text-muted">(optional)</span></label>
          <textarea id="notes" name="notes" rows={3} maxLength={1000} className={inputClass} />
        </div>
      </div>
      {state.error && <p role="alert" className="text-sm text-red-600 dark:text-red-300">{state.error}</p>}
      <button type="submit" disabled={pending} className={`${primaryBtn} w-full`}>{pending ? "Saving" : "Add lead"}</button>
    </form>
  );
}

export function AddLead({ people }: { people: { id: string; name: string }[] }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={ghostBtn}><i className="bi bi-plus-lg" aria-hidden="true" /> Add lead</button>
      <Modal open={open} onClose={() => setOpen(false)} title="Add a lead" wide>
        <Form people={people} onDone={() => setOpen(false)} />
      </Modal>
    </>
  );
}
