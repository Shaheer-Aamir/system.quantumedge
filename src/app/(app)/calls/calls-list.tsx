"use client";

import { useState } from "react";
import { Avatar } from "@/components/avatar";
import { CallForm } from "@/components/call-form";
import { MeetingForm } from "@/components/meeting-form";
import { Modal } from "@/components/modal";
import type { LeadHit } from "@/lib/lead-hit";
import { outcomeMeta } from "@/lib/outcomes";
import { fmtTime } from "@/lib/time";
import { deleteLeadsAction } from "../leads/actions";
import { LeadDetail, type LeadRow } from "../leads/lead-detail";
import { CallEditForm, type CallRowData } from "./call-edit-form";

export function CallsList({ rows, people, isSuper }: { rows: CallRowData[]; people: { id: string; name: string }[]; isSuper: boolean }) {
  const [lead, setLead] = useState<LeadRow | null>(null); // the lead window, same one as on the Leads tab
  const [callLead, setCallLead] = useState<LeadRow | null>(null);
  const [meetingLead, setMeetingLead] = useState<LeadRow | null>(null);
  const [editing, setEditing] = useState<CallRowData | null>(null);

  const nameOf = (l: LeadRow) => l.company || l.contactName || "lead";
  const asHit = (r: LeadRow): LeadHit => ({
    id: r.id, company: r.company, contactName: r.contactName, phone: r.phone, email: r.email, status: r.status,
    callCount: r.callCount, lastOutcome: r.lastOutcome, lastCalledAt: r.lastCalledAt,
  });
  async function removeLead(l: LeadRow) {
    if (!window.confirm(`Delete ${nameOf(l)} and all its call logs and meetings? This cannot be undone.`)) return;
    await deleteLeadsAction([l.id]);
    setLead(null);
  }

  return (
    <>
      <ul className="space-y-3">
        {rows.map((row) => {
          const meta = outcomeMeta(row.outcome);
          const l = row.lead;
          return (
            <li key={row.id} className="flex flex-wrap items-center gap-x-5 gap-y-3 rounded-2xl border border-line bg-surface/60 p-4">
              <p className="w-16 shrink-0 text-sm font-medium tabular-nums">{fmtTime(row.calledAt)}</p>
              <div className="min-w-[12rem] flex-1">
                <button type="button" onClick={() => setLead(l)} className="text-left font-medium hover:text-ice focus-visible:outline-2 focus-visible:outline-ice">
                  {l.company || l.contactName}
                </button>
                <p className="text-sm text-muted">
                  {l.company && l.contactName ? `${l.contactName} · ` : ""}
                  <a href={`tel:${l.phone}`} className="hover:text-fg">{l.phone}</a>
                </p>
                {row.notes && <p className="mt-1.5 text-sm text-muted">{row.notes}</p>}
              </div>
              <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ${meta.tone}`}>
                <i className={`bi ${meta.icon}`} aria-hidden="true" /> {meta.label}
              </span>
              <div className="flex items-center gap-2 text-sm text-muted" title={row.adminName}>
                <Avatar name={row.adminName} src={row.adminAvatar} size={26} />
                <span className="hidden sm:inline">{row.adminName}</span>
              </div>
              {row.canManage && (
                <button type="button" onClick={() => setEditing(row)} aria-label={`Edit or delete the call with ${nameOf(l)}`} title="Edit or delete this call"
                  className="rounded-lg p-2 text-muted transition hover:bg-fg/5 hover:text-fg focus-visible:outline-2 focus-visible:outline-ice">
                  <i className="bi bi-pencil" aria-hidden="true" />
                </button>
              )}
            </li>
          );
        })}
      </ul>

      <Modal open={!!lead} onClose={() => setLead(null)} title={lead ? nameOf(lead) : "Lead"} wide>
        {lead && (
          <LeadDetail key={lead.id} lead={lead} people={people} isSuper={isSuper} onClose={() => setLead(null)} onDelete={() => removeLead(lead)}
            onLogCall={() => { setCallLead(lead); setLead(null); }} onBookMeeting={() => { setMeetingLead(lead); setLead(null); }} />
        )}
      </Modal>
      <Modal open={!!callLead} onClose={() => setCallLead(null)} title={callLead ? `Log a call: ${nameOf(callLead)}` : "Log a call"} wide>
        {callLead && <CallForm key={callLead.id} preselected={asHit(callLead)} onDone={() => setCallLead(null)} />}
      </Modal>
      <Modal open={!!meetingLead} onClose={() => setMeetingLead(null)} title={meetingLead ? `Book a meeting: ${nameOf(meetingLead)}` : "Book a meeting"} wide>
        {meetingLead && <MeetingForm key={meetingLead.id} preselected={asHit(meetingLead)} onDone={() => setMeetingLead(null)} />}
      </Modal>
      <Modal open={!!editing} onClose={() => setEditing(null)} title="Edit call" wide>
        {editing && <CallEditForm key={editing.id} row={editing} onDone={() => setEditing(null)} />}
      </Modal>
    </>
  );
}
