"use client";

import { useState, useTransition } from "react";
import { ghostBtn, inputClass } from "@/components/form-styles";
import { fmtDateTime } from "@/lib/time";
import { setRateAction } from "./actions";

export function RateControl({ rate, updatedAt }: { rate: number | null; updatedAt: number | null }) {
  const [value, setValue] = useState(rate ? String(rate) : "");
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  const changed = value.trim() !== (rate ? String(rate) : "");

  return (
    <div className={`rounded-2xl border p-4 ${rate ? "border-line bg-surface/60" : "border-amber-500/40 bg-amber-500/10"}`}>
      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1.5">
          <label htmlFor="rate" className="text-sm font-medium">1 USD equals (PKR)</label>
          <input id="rate" inputMode="decimal" value={value} onChange={(e) => setValue(e.target.value)} placeholder="Enter today's rate" className={`${inputClass} !w-44`} />
        </div>
        <button type="button" disabled={pending || !changed} className={ghostBtn}
          onClick={() => { setError(""); start(async () => { const r = await setRateAction(value); if (r.error) setError(r.error); }); }}>
          {pending ? "Saving" : "Update rate"}
        </button>
        <p className="pb-2 text-xs text-muted">
          {rate && updatedAt ? `Last updated ${fmtDateTime(updatedAt)}. ` : "Set this before logging payments. "}
          Each payment keeps the rate it was recorded with, so past totals never change.
        </p>
      </div>
      {error && <p role="alert" className="mt-2 text-sm text-red-600 dark:text-red-300">{error}</p>}
    </div>
  );
}
