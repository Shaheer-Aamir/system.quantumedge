"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { Modal } from "@/components/modal";
import { MeetingForm } from "@/components/meeting-form";
import type { LeadHit } from "@/lib/lead-hit";
import { Avatar } from "@/components/avatar";
import { ghostBtn, inputClass, primaryBtn } from "@/components/form-styles";
import { MEETING_STATUSES, statusMeta } from "@/lib/outcomes";
import { fmtDateTime, fmtDayLong, fmtMonthLong, fmtTime, msToLocalInput, shiftYm, todayYmd, ymdOf } from "@/lib/time";
import { deleteMeetingAction, updateMeetingAction } from "./actions";

export type MeetingItem = {
  id: string; title: string; startsAt: number; durationMin: number; status: string; notes: string | null;
  company: string | null; contactName: string | null; phone: string | null; email: string | null;
  adminId: string; adminName: string; adminAvatar: string | null;
};
type Person = { id: string; name: string };
type Props = { month: string; adminId: string; meetings: MeetingItem[]; people: Person[]; meId: string; isSuper: boolean; preselect?: LeadHit | null };

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const leadName = (m: MeetingItem) => m.company || m.contactName || "Lead";

function MeetingDetail({ m, canEdit, onClose }: { m: MeetingItem; canEdit: boolean; onClose: () => void }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState("");
  const [when, setWhen] = useState(msToLocalInput(m.startsAt));
  const status = statusMeta(m.status);

  function run(fn: () => Promise<{ error?: string }>, after?: () => void) {
    setError("");
    start(async () => {
      const res = await fn();
      if (res.error) setError(res.error);
      else after?.();
    });
  }

  return (
    <div className="space-y-5">
      <div>
        <p className="text-xl font-semibold">{leadName(m)}</p>
        <p className="mt-1 text-sm text-muted">{m.title} · {m.durationMin} min</p>
      </div>

      <dl className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
        <div><dt className="text-muted">When</dt><dd className="font-medium">{fmtDateTime(m.startsAt)}</dd></div>
        <div><dt className="text-muted">Status</dt>
          <dd><span className={`inline-block rounded-full px-3 py-0.5 text-xs font-medium ${status.tone}`}>{status.label}</span></dd></div>
        {m.contactName && m.company && <div><dt className="text-muted">Contact</dt><dd className="font-medium">{m.contactName}</dd></div>}
        {m.phone && <div><dt className="text-muted">Phone</dt><dd><a className="font-medium hover:text-ice" href={`tel:${m.phone}`}>{m.phone}</a></dd></div>}
        {m.email && <div><dt className="text-muted">Email</dt><dd><a className="font-medium hover:text-ice" href={`mailto:${m.email}`}>{m.email}</a></dd></div>}
        <div><dt className="text-muted">Booked by</dt>
          <dd className="flex items-center gap-2 font-medium"><Avatar name={m.adminName} src={m.adminAvatar} size={22} /> {m.adminName}</dd></div>
      </dl>
      {m.notes && <p className="rounded-xl bg-surface/60 p-3 text-sm text-muted">{m.notes}</p>}

      {canEdit && (
        <>
          <fieldset className="space-y-2">
            <legend className="text-sm font-medium">Update status</legend>
            <div className="flex flex-wrap gap-2">
              {MEETING_STATUSES.map((s) => (
                <button key={s.value} type="button" disabled={pending} aria-pressed={m.status === s.value}
                  onClick={() => run(() => updateMeetingAction(m.id, { status: s.value }))}
                  className={`rounded-xl border px-3 py-1.5 text-sm transition focus-visible:outline-2 focus-visible:outline-ice ${
                    m.status === s.value ? "border-ice bg-accent/20" : "border-line text-muted hover:text-fg"
                  }`}>{s.label}</button>
              ))}
            </div>
          </fieldset>

          <div className="space-y-2">
            <label htmlFor="resched" className="text-sm font-medium">Reschedule</label>
            <div className="flex flex-wrap gap-2">
              <input id="resched" type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} className={`${inputClass} !w-auto`} />
              <button type="button" disabled={pending} className={ghostBtn}
                onClick={() => run(() => updateMeetingAction(m.id, { startsAtLocal: when }))}>Save time</button>
            </div>
          </div>

          <div className="flex justify-end border-t border-line pt-4">
            <button type="button" disabled={pending}
              onClick={() => window.confirm("Delete this meeting?") && run(() => deleteMeetingAction(m.id), onClose)}
              className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm text-red-600 transition hover:bg-red-500/10 dark:text-red-300">
              <i className="bi bi-trash3" aria-hidden="true" /> Delete meeting
            </button>
          </div>
        </>
      )}
      {error && <p role="alert" className="text-sm text-red-600 dark:text-red-300">{error}</p>}
    </div>
  );
}

export function CalendarView({ month, adminId, meetings, people, meId, isSuper, preselect }: Props) {
  const today = todayYmd();
  const [selected, setSelected] = useState(today.startsWith(month) ? today : `${month}-01`);
  const [openId, setOpenId] = useState<string | null>(null);
  const [creating, setCreating] = useState(!!preselect);

  const byDay = useMemo(() => {
    const map = new Map<string, MeetingItem[]>();
    for (const m of [...meetings].sort((a, b) => a.startsAt - b.startsAt)) {
      const k = ymdOf(m.startsAt);
      map.set(k, [...(map.get(k) ?? []), m]);
    }
    return map;
  }, [meetings]);

  const cells = useMemo(() => {
    const [y, mo] = month.split("-").map(Number);
    const first = Date.UTC(y, mo - 1, 1);
    const offset = (new Date(first).getUTCDay() + 6) % 7;
    return Array.from({ length: 42 }, (_, i) => new Date(first + (i - offset) * 86_400_000).toISOString().slice(0, 10));
  }, [month]);

  const q = (m: string) => `/calendar?m=${m}${adminId ? `&a=${adminId}` : ""}`;
  const qa = (a: string) => `/calendar?m=${month}${a ? `&a=${a}` : ""}`;
  const open = meetings.find((m) => m.id === openId) ?? null;
  const dayMeetings = byDay.get(selected) ?? [];
  function closeCreate() {
    setCreating(false);
    if (preselect) {
      // Opened from a lead: drop ?lead= from the address so it does not reopen on refresh
      const params = new URLSearchParams(window.location.search);
      params.delete("lead");
      window.history.replaceState(null, "", `/calendar${params.size ? `?${params}` : ""}`);
    }
  }
  const monthCount = meetings.filter((m) => ymdOf(m.startsAt).startsWith(month)).length;

  return (
    <>
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <Link href={q(shiftYm(month, -1))} aria-label="Previous month" className={`${ghostBtn} !px-3`}><i className="bi bi-chevron-left" aria-hidden="true" /></Link>
          <p className="min-w-40 text-center text-lg font-semibold">{fmtMonthLong(month)}</p>
          <Link href={q(shiftYm(month, 1))} aria-label="Next month" className={`${ghostBtn} !px-3`}><i className="bi bi-chevron-right" aria-hidden="true" /></Link>
          {!today.startsWith(month) && <Link href={q(today.slice(0, 7))} className={ghostBtn}>Today</Link>}
        </div>
        <div className="flex flex-wrap gap-2 sm:ml-auto" role="group" aria-label="Filter by admin">
          {[{ id: "", name: "All admins" }, ...people].map((p) => (
            <Link key={p.id || "all"} href={qa(p.id)} aria-current={adminId === p.id ? "true" : undefined}
              className={`rounded-full border px-3.5 py-1.5 text-sm transition ${adminId === p.id ? "border-ice bg-accent/20 text-fg" : "border-line text-muted hover:text-fg"}`}>
              {p.name}{p.id === meId ? " (you)" : ""}
            </Link>
          ))}
        </div>
        <button type="button" onClick={() => setCreating(true)} className={primaryBtn}>
          <i className="bi bi-plus-lg" aria-hidden="true" /> New meeting
        </button>
      </div>

      <div className="overflow-hidden rounded-2xl border border-line bg-surface/40">
        <div className="grid grid-cols-7 border-b border-line text-center text-xs text-muted">
          {WEEKDAYS.map((d) => <div key={d} className="py-2.5 font-medium">{d}</div>)}
        </div>
        <div className="grid grid-cols-7">
          {cells.map((ymd, i) => {
            const inMonth = ymd.startsWith(month);
            const list = byDay.get(ymd) ?? [];
            const isSel = ymd === selected;
            return (
              <div key={ymd} onClick={() => setSelected(ymd)}
                className={`min-h-[4.5rem] cursor-pointer border-b border-line p-1.5 transition hover:bg-fg/5 sm:min-h-28 ${i % 7 !== 6 ? "border-r" : ""} ${isSel ? "bg-accent/10" : ""} ${inMonth ? "" : "opacity-40"}`}>
                <span className={`flex size-7 items-center justify-center rounded-full text-sm ${ymd === today ? "bg-accent font-semibold text-white" : ""}`}>
                  {Number(ymd.slice(8))}
                </span>
                <div className="mt-1 hidden space-y-1 sm:block">
                  {list.slice(0, 2).map((m) => (
                    <button key={m.id} type="button" onClick={(e) => { e.stopPropagation(); setSelected(ymd); setOpenId(m.id); }}
                      className={`block w-full truncate rounded-md px-1.5 py-0.5 text-left text-xs ${statusMeta(m.status).chip}`}>
                      {fmtTime(m.startsAt)} {leadName(m)}
                    </button>
                  ))}
                  {list.length > 2 && <p className="px-1.5 text-xs text-muted">+{list.length - 2} more</p>}
                </div>
                {list.length > 0 && (
                  <div className="mt-1 flex justify-center gap-0.5 sm:hidden" aria-hidden="true">
                    {list.slice(0, 3).map((m) => <span key={m.id} className="size-1.5 rounded-full bg-ice" />)}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <section className="mt-8" aria-live="polite">
        <h2 className="text-lg font-semibold">{fmtDayLong(selected)}</h2>
        <p className="mb-4 mt-1 text-sm text-muted">{monthCount} meeting{monthCount === 1 ? "" : "s"} in {fmtMonthLong(month)}</p>
        {dayMeetings.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-line px-6 py-10 text-center text-sm text-muted">No meetings on this day.</p>
        ) : (
          <ul className="space-y-3">
            {dayMeetings.map((m) => {
              const s = statusMeta(m.status);
              return (
                <li key={m.id}>
                  <button type="button" onClick={() => setOpenId(m.id)}
                    className="flex w-full flex-wrap items-center gap-x-5 gap-y-2 rounded-2xl border border-line bg-surface/60 p-4 text-left transition hover:border-ice/60 focus-visible:outline-2 focus-visible:outline-ice">
                    <p className="w-28 shrink-0 text-sm font-medium tabular-nums">{fmtTime(m.startsAt)} · {m.durationMin} min</p>
                    <div className="min-w-[10rem] flex-1">
                      <p className="font-medium">{leadName(m)}</p>
                      <p className="text-sm text-muted">{m.title}</p>
                    </div>
                    <span className={`rounded-full px-3 py-1 text-xs font-medium ${s.tone}`}>{s.label}</span>
                    <span className="flex items-center gap-2 text-sm text-muted"><Avatar name={m.adminName} src={m.adminAvatar} size={24} /> {m.adminName}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <Modal open={!!open} onClose={() => setOpenId(null)} title="Meeting details" wide>
        {open && <MeetingDetail key={open.id + open.startsAt + open.status} m={open} canEdit={open.adminId === meId || isSuper} onClose={() => setOpenId(null)} />}
      </Modal>
      <Modal open={creating} onClose={closeCreate} title="New meeting" wide>
        <MeetingForm onDone={closeCreate} preselected={preselect} />
      </Modal>
    </>
  );
}
