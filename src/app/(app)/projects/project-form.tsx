"use client";

import { inputClass } from "@/components/form-styles";
import { fmtUsd, parseMoneyToCents } from "@/lib/money";
import { PROJECT_STATUSES } from "@/lib/project-status";
import type { ProjectInput } from "./actions";

export const emptyProject = (ownerId: string): ProjectInput => ({ name: "", client: "", status: "ongoing", agreed: "", upfront: "", startedOn: "", ownerId, notes: "" });

export function ProjectFields({ value, onChange, people }: {
  value: ProjectInput; onChange: (v: ProjectInput) => void; people: { id: string; name: string }[];
}) {
  const set = (k: keyof ProjectInput) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => onChange({ ...value, [k]: e.target.value });
  const agreed = value.agreed.trim() === "" ? 0 : parseMoneyToCents(value.agreed);
  const upfront = value.upfront.trim() === "" ? 0 : parseMoneyToCents(value.upfront);
  const balance = agreed !== null && upfront !== null && agreed >= upfront ? agreed - upfront : null;

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <div className="space-y-1.5 sm:col-span-2">
        <label htmlFor="pj-name" className="text-sm font-medium">Project name</label>
        <input id="pj-name" value={value.name} onChange={set("name")} maxLength={120} className={inputClass} />
      </div>
      <div className="space-y-1.5">
        <label htmlFor="pj-client" className="text-sm font-medium">Client</label>
        <input id="pj-client" value={value.client} onChange={set("client")} maxLength={120} className={inputClass} />
      </div>
      <div className="space-y-1.5">
        <label htmlFor="pj-status" className="text-sm font-medium">Status</label>
        <select id="pj-status" value={value.status} onChange={set("status")} className={inputClass}>
          {PROJECT_STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>
      </div>
      <div className="space-y-1.5">
        <label htmlFor="pj-agreed" className="text-sm font-medium">Total project amount (USD)</label>
        <input id="pj-agreed" inputMode="decimal" value={value.agreed} onChange={set("agreed")} placeholder="1500" className={inputClass} />
      </div>
      <div className="space-y-1.5">
        <label htmlFor="pj-upfront" className="text-sm font-medium">Charged upfront (USD)</label>
        <input id="pj-upfront" inputMode="decimal" value={value.upfront} onChange={set("upfront")} placeholder="750" className={inputClass} />
      </div>
      {balance !== null && (value.agreed.trim() !== "") && (
        <p className="rounded-xl bg-surface/60 px-4 py-3 text-sm sm:col-span-2">
          Balance after the upfront payment: <strong>{fmtUsd(balance)}</strong>
        </p>
      )}
      <div className="space-y-1.5">
        <label htmlFor="pj-start" className="text-sm font-medium">Start date <span className="font-normal text-muted">(optional)</span></label>
        <input id="pj-start" type="date" value={value.startedOn} onChange={set("startedOn")} className={inputClass} />
      </div>
      <div className="space-y-1.5">
        <label htmlFor="pj-owner" className="text-sm font-medium">Closed by</label>
        <select id="pj-owner" value={value.ownerId} onChange={set("ownerId")} className={inputClass}>
          {people.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </div>
      <div className="space-y-1.5 sm:col-span-2">
        <label htmlFor="pj-notes" className="text-sm font-medium">Notes <span className="font-normal text-muted">(optional)</span></label>
        <textarea id="pj-notes" rows={3} maxLength={1000} value={value.notes} onChange={set("notes")} className={inputClass} />
      </div>
    </div>
  );
}
