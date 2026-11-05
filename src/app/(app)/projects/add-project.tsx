"use client";

import { useState, useTransition } from "react";
import { Modal } from "@/components/modal";
import { inputClass, primaryBtn } from "@/components/form-styles";
import { fmtUsd, parseMoneyToCents } from "@/lib/money";
import { todayYmd } from "@/lib/time";
import { createProjectAction } from "./actions";
import { ProjectFields, emptyProject } from "./project-form";

export function AddProject({ people, meId, rate }: { people: { id: string; name: string }[]; meId: string; rate: number | null }) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState(emptyProject(meId));
  const [received, setReceived] = useState(true);
  const [date, setDate] = useState(todayYmd());
  const [payRate, setPayRate] = useState(rate ? String(rate) : "");
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  const upfront = value.upfront.trim() === "" ? 0 : parseMoneyToCents(value.upfront) ?? 0;

  function submit() {
    setError("");
    start(async () => {
      const r = await createProjectAction(value, received && upfront > 0 ? { date, rate: payRate } : null);
      if (r.error) setError(r.error);
      else { setOpen(false); setValue(emptyProject(meId)); setReceived(true); }
    });
  }

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={primaryBtn}><i className="bi bi-plus-lg" aria-hidden="true" /> Add project</button>
      <Modal open={open} onClose={() => setOpen(false)} title="Add a project" wide>
        <div className="space-y-5">
          <ProjectFields value={value} onChange={setValue} people={people} />

          {upfront > 0 && (
            <div className="space-y-3 rounded-2xl border border-line bg-surface/50 p-4">
              <label className="flex cursor-pointer items-center gap-3 text-sm font-medium">
                <input type="checkbox" checked={received} onChange={(e) => setReceived(e.target.checked)} className="size-4 accent-[#4d40e5]" />
                The {fmtUsd(upfront)} upfront payment has already been received
              </label>
              {received && (
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <label htmlFor="up-date" className="text-xs text-muted">Date received</label>
                    <input id="up-date" type="date" value={date} max={todayYmd()} onChange={(e) => setDate(e.target.value)} className={inputClass} />
                  </div>
                  <div className="space-y-1.5">
                    <label htmlFor="up-rate" className="text-xs text-muted">PKR per USD</label>
                    <input id="up-rate" inputMode="decimal" value={payRate} onChange={(e) => setPayRate(e.target.value)} className={inputClass} />
                  </div>
                </div>
              )}
              <p className="text-xs text-muted">{received ? "This is saved as the first payment, so it counts as collected cash." : "It stays as money still to collect. You can record it later from the project."}</p>
            </div>
          )}

          {error && <p role="alert" className="text-sm text-red-600 dark:text-red-300">{error}</p>}
          <button type="button" onClick={submit} disabled={pending} className={`${primaryBtn} w-full`}>{pending ? "Saving" : "Save project"}</button>
        </div>
      </Modal>
    </>
  );
}
