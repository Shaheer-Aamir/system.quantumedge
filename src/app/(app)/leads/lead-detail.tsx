"use client";

import { useEffect, useState, useTransition } from "react";
import { ghostBtn, inputClass, primaryBtn } from "@/components/form-styles";
import { googleSearchUrl, leadSearchQuery } from "@/lib/google-search";
import { LEAD_STATUSES } from "@/lib/lead-status";
import { outcomeMeta, statusMeta } from "@/lib/outcomes";
import { fmtDateTime } from "@/lib/time";
import { getLeadHistoryAction, updateLeadAction } from "./actions";

export type LeadRow = {
  id: string; company: string | null; contactName: string | null; phone: string | null; email: string | null;
  status: string; assignedTo: string | null; assignedName: string | null; notes: string | null; extra: Record<string, string>;
  callCount: number; lastOutcome: string | null; lastCalledAt: number | null; createdAt: number; source: string;
};
type History = Awaited<ReturnType<typeof getLeadHistoryAction>>;

export function LeadDetail({ lead, people, isSuper, onClose, onDelete, onLogCall, onBookMeeting }: {
  lead: LeadRow; people: { id: string; name: string }[]; isSuper: boolean; onClose: () => void; onDelete: () => void;
  onLogCall: () => void; onBookMeeting: () => void;
}) {
  const [form, setForm] = useState({
    company: lead.company ?? "", contactName: lead.contactName ?? "", phone: lead.phone ?? "", email: lead.email ?? "",
    status: lead.status, assignedTo: lead.assignedTo ?? "", notes: lead.notes ?? "",
  });
  const [history, setHistory] = useState<History | null>(null);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [pending, start] = useTransition();
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setSaved(false);
    setForm((f) => ({ ...f, [k]: e.target.value }));
  };

  useEffect(() => { getLeadHistoryAction(lead.id).then(setHistory).catch(() => setHistory({ calls: [], meetings: [] })); }, [lead.id]);

  function save() {
    setError("");
    start(async () => {
      const res = await updateLeadAction(lead.id, form);
      if (res.error) setError(res.error);
      else { setSaved(true); onClose(); }
    });
  }

  const extras = Object.entries(lead.extra);
  const field = (id: keyof typeof form, label: string, type = "text") => (
    <div className="space-y-1.5">
      <label htmlFor={`ld-${id}`} className="text-sm font-medium">{label}</label>
      <input id={`ld-${id}`} type={type} value={form[id]} onChange={set(id)} className={inputClass} />
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2">
        {field("company", "Company")}
        {field("contactName", "Contact name")}
        {field("phone", "Phone number", "tel")}
        {field("email", "Email", "email")}
        <div className="space-y-1.5">
          <label htmlFor="ld-status" className="text-sm font-medium">Status</label>
          <select id="ld-status" value={form.status} onChange={set("status")} className={inputClass}>
            {LEAD_STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
        </div>
        <div className="space-y-1.5">
          <label htmlFor="ld-assigned" className="text-sm font-medium">Assigned to</label>
          <select id="ld-assigned" value={form.assignedTo} onChange={set("assignedTo")} className={inputClass}>
            <option value="">Unassigned</option>
            {people.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <label htmlFor="ld-notes" className="text-sm font-medium">Notes</label>
          <textarea id="ld-notes" rows={3} maxLength={1000} value={form.notes} onChange={set("notes")} className={inputClass} />
        </div>
      </div>

      {extras.length > 0 && (
        <div>
          <h3 className="mb-2 text-sm font-medium">Imported details</h3>
          <dl className="grid gap-x-6 gap-y-2 rounded-xl bg-surface/60 p-4 text-sm sm:grid-cols-2">
            {extras.map(([k, v]) => <div key={k}><dt className="text-muted">{k}</dt><dd className="break-words font-medium">{v}</dd></div>)}
          </dl>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={onLogCall} className={primaryBtn}><i className="bi bi-telephone" aria-hidden="true" /> Log a call</button>
        <button type="button" onClick={onBookMeeting} className={ghostBtn}><i className="bi bi-calendar-plus" aria-hidden="true" /> Book a meeting</button>
        <a href={googleSearchUrl(lead)} target="_blank" rel="noopener noreferrer" title={`Search Google: ${leadSearchQuery(lead)}`} className={ghostBtn}>
          <i className="bi bi-google" aria-hidden="true" /> Search on Google<span className="sr-only"> (opens in a new tab)</span>
        </a>
      </div>

      <div>
        <h3 className="mb-2 text-sm font-medium">Call history</h3>
        {!history ? <p className="text-sm text-muted">Loading</p> : history.calls.length === 0 ? (
          <p className="text-sm text-muted">No calls logged for this lead yet.</p>
        ) : (
          <ul className="space-y-2">
            {history.calls.map((c) => {
              const m = outcomeMeta(c.outcome);
              return (
                <li key={c.id} className="rounded-xl border border-line p-3 text-sm">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${m.tone}`}><i className={`bi ${m.icon}`} aria-hidden="true" /> {m.label}</span>
                    <span className="text-muted">{fmtDateTime(c.calledAt)} · {c.admin}</span>
                  </div>
                  {c.notes && <p className="mt-2 text-muted">{c.notes}</p>}
                </li>
              );
            })}
          </ul>
        )}
        {history && history.meetings.length > 0 && (
          <ul className="mt-3 space-y-2">
            {history.meetings.map((m) => (
              <li key={m.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-line p-3 text-sm">
                <span><i className="bi bi-calendar-event mr-2 text-ice" aria-hidden="true" />{m.title}</span>
                <span className="text-muted">{fmtDateTime(m.startsAt)} · {statusMeta(m.status).label}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {error && <p role="alert" className="text-sm text-red-600 dark:text-red-300">{error}</p>}
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
        {isSuper ? (
          <button type="button" onClick={onDelete} className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm text-red-600 transition hover:bg-red-500/10 dark:text-red-300">
            <i className="bi bi-trash3" aria-hidden="true" /> Delete lead
          </button>
        ) : <span />}
        <div className="flex gap-2">
          <button type="button" onClick={onClose} className={ghostBtn}>Cancel</button>
          <button type="button" onClick={save} disabled={pending} className={primaryBtn}>{pending ? "Saving" : saved ? "Saved" : "Save changes"}</button>
        </div>
      </div>
    </div>
  );
}
