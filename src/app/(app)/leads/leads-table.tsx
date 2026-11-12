"use client";

import { useState, useTransition } from "react";
import { CallForm } from "@/components/call-form";
import { MeetingForm } from "@/components/meeting-form";
import { Modal } from "@/components/modal";
import type { LeadHit } from "@/lib/lead-hit";
import { googleSearchUrl, leadSearchQuery } from "@/lib/google-search";
import { LEAD_STATUSES, leadStatusMeta } from "@/lib/lead-status";
import { outcomeMeta } from "@/lib/outcomes";
import { fmtDateTime } from "@/lib/time";
import { bulkUpdateLeadsAction, deleteLeadsAction } from "./actions";
import { LeadDetail, type LeadRow } from "./lead-detail";

const selectClass = "rounded-xl border border-line bg-bg/60 px-3 py-2 text-sm outline-none focus:border-ice";

export function LeadsTable({ rows, people, isSuper }: { rows: LeadRow[]; people: { id: string; name: string }[]; isSuper: boolean }) {
  const [selected, setSelected] = useState<string[]>([]);
  const [openId, setOpenId] = useState<string | null>(null);
  // The call and meeting forms open on top of this page, so you never leave the Leads list.
  const [callLead, setCallLead] = useState<LeadRow | null>(null);
  const [meetingLead, setMeetingLead] = useState<LeadRow | null>(null);
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  const open = rows.find((r) => r.id === openId) ?? null;
  const allOnPage = rows.length > 0 && rows.every((r) => selected.includes(r.id));

  const asHit = (r: LeadRow): LeadHit => ({
    id: r.id, company: r.company, contactName: r.contactName, phone: r.phone, email: r.email, status: r.status,
    callCount: r.callCount, lastOutcome: r.lastOutcome, lastCalledAt: r.lastCalledAt,
  });
  const nameOf = (r: LeadRow) => r.company || r.contactName || "lead";
  const toggle = (id: string) => setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

  function run(fn: () => Promise<{ error?: string }>) {
    setError("");
    start(async () => {
      const res = await fn();
      if (res.error) setError(res.error);
      else setSelected([]);
    });
  }
  function remove(ids: string[]) {
    if (window.confirm(`Delete ${ids.length} lead${ids.length === 1 ? "" : "s"} and all their call logs and meetings? This cannot be undone.`)) {
      run(async () => { const r = await deleteLeadsAction(ids); setOpenId(null); return r; });
    }
  }

  if (rows.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-line px-6 py-14 text-center">
        <p className="font-medium">No leads found</p>
        <p className="mt-1 text-sm text-muted">Import a file, add a lead, or change your filters.</p>
      </div>
    );
  }

  return (
    <>
      {selected.length > 0 && (
        <div className="mb-3 flex flex-wrap items-center gap-3 rounded-2xl border border-ice/50 bg-accent/15 px-4 py-3 text-sm">
          <span className="font-medium">{selected.length} selected</span>
          <select aria-label="Assign selected leads" disabled={pending} defaultValue="__" className={selectClass}
            onChange={(e) => { const v = e.target.value; e.target.value = "__"; if (v !== "__") run(() => bulkUpdateLeadsAction(selected, { assignedTo: v === "none" ? "" : v })); }}>
            <option value="__" disabled>Assign to</option>
            <option value="none">Unassigned</option>
            {people.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <select aria-label="Set status of selected leads" disabled={pending} defaultValue="__" className={selectClass}
            onChange={(e) => { const v = e.target.value; e.target.value = "__"; if (v !== "__") run(() => bulkUpdateLeadsAction(selected, { status: v })); }}>
            <option value="__" disabled>Set status</option>
            {LEAD_STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
          {isSuper && (
            <button type="button" disabled={pending} onClick={() => remove(selected)} className="flex items-center gap-2 text-red-600 dark:text-red-300">
              <i className="bi bi-trash3" aria-hidden="true" /> Delete
            </button>
          )}
          <button type="button" onClick={() => setSelected([])} className="ml-auto text-muted hover:text-fg">Clear</button>
        </div>
      )}
      {error && <p role="alert" className="mb-3 text-sm text-red-600 dark:text-red-300">{error}</p>}

      <div className="overflow-x-auto rounded-2xl border border-line bg-surface/40">
        <table className="w-full min-w-[60rem] text-left text-sm">
          <thead className="border-b border-line text-xs text-muted">
            <tr>
              <th className="w-10 px-4 py-3">
                <input type="checkbox" aria-label="Select all leads on this page" checked={allOnPage}
                  onChange={() => setSelected(allOnPage ? [] : rows.map((r) => r.id))} className="size-4 accent-[#4d40e5]" />
              </th>
              <th className="px-3 py-3 font-medium">Lead</th>
              <th className="px-3 py-3 font-medium">Phone</th>
              <th className="px-3 py-3 font-medium">Status</th>
              <th className="px-3 py-3 font-medium">Assigned</th>
              <th className="px-3 py-3 font-medium">Calls</th>
              <th className="px-3 py-3 font-medium">Last called</th>
              <th className="px-3 py-3"><span className="sr-only">Actions</span></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const s = leadStatusMeta(r.status);
              return (
                <tr key={r.id} className={`border-b border-line last:border-0 transition hover:bg-fg/5 ${selected.includes(r.id) ? "bg-accent/10" : ""}`}>
                  <td className="px-4 py-3">
                    <input type="checkbox" aria-label={`Select ${r.company || r.contactName}`} checked={selected.includes(r.id)} onChange={() => toggle(r.id)} className="size-4 accent-[#4d40e5]" />
                  </td>
                  <td className="px-3 py-3">
                    <div className="flex items-center gap-2.5">
                      <a href={googleSearchUrl(r)} target="_blank" rel="noopener noreferrer"
                        title={`Search Google: ${leadSearchQuery(r)}`} aria-label={`Search Google for ${nameOf(r)} (opens in a new tab)`}
                        className="flex size-8 shrink-0 items-center justify-center rounded-full border border-line text-muted transition hover:border-ice hover:text-ice focus-visible:outline-2 focus-visible:outline-ice">
                        <i className="bi bi-google text-sm" aria-hidden="true" />
                      </a>
                      <button type="button" onClick={() => setOpenId(r.id)} className="min-w-0 text-left focus-visible:outline-2 focus-visible:outline-ice">
                        <span className="block font-medium hover:text-ice">{r.company || r.contactName}</span>
                        {r.company && r.contactName && <span className="block text-xs text-muted">{r.contactName}</span>}
                      </button>
                    </div>
                  </td>
                  <td className="px-3 py-3 tabular-nums">{r.phone}</td>
                  <td className="px-3 py-3"><span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${s.tone}`}>{s.label}</span></td>
                  <td className="px-3 py-3 text-muted">{r.assignedName ?? "Unassigned"}</td>
                  <td className="px-3 py-3 tabular-nums">{r.callCount}</td>
                  <td className="px-3 py-3 text-muted">
                    {r.lastCalledAt ? fmtDateTime(r.lastCalledAt) : "Never"}
                    {r.lastOutcome && (
                      <span className={`mt-1 flex w-fit items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-medium ${outcomeMeta(r.lastOutcome).tone}`}>
                        <i className={`bi ${outcomeMeta(r.lastOutcome).icon}`} aria-hidden="true" /> {outcomeMeta(r.lastOutcome).label}
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-3 text-right">
                    <button type="button" onClick={() => setCallLead(r)} aria-label={`Log a call with ${nameOf(r)}`} title="Log a call"
                      className="inline-flex size-9 items-center justify-center rounded-full bg-accent/20 text-ice transition hover:bg-accent/40 focus-visible:outline-2 focus-visible:outline-ice">
                      <i className="bi bi-telephone-plus" aria-hidden="true" />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <Modal open={!!open} onClose={() => setOpenId(null)} title={open ? open.company || open.contactName || "Lead" : "Lead"} wide>
        {open && <LeadDetail key={open.id} lead={open} people={people} isSuper={isSuper} onClose={() => setOpenId(null)} onDelete={() => remove([open.id])}
          onLogCall={() => { setOpenId(null); setCallLead(open); }} onBookMeeting={() => { setOpenId(null); setMeetingLead(open); }} />}
      </Modal>

      <Modal open={!!callLead} onClose={() => setCallLead(null)} title={callLead ? `Log a call: ${nameOf(callLead)}` : "Log a call"} wide>
        {callLead && <CallForm key={callLead.id} preselected={asHit(callLead)} onDone={() => setCallLead(null)} />}
      </Modal>
      <Modal open={!!meetingLead} onClose={() => setMeetingLead(null)} title={meetingLead ? `Book a meeting: ${nameOf(meetingLead)}` : "Book a meeting"} wide>
        {meetingLead && <MeetingForm key={meetingLead.id} preselected={asHit(meetingLead)} onDone={() => setMeetingLead(null)} />}
      </Modal>
    </>
  );
}

