"use client";

import { useState } from "react";
import { ghostBtn, inputClass, primaryBtn } from "@/components/form-styles";
import { Modal } from "@/components/modal";
import { fmtDayLong, isYmd, shiftYmd } from "@/lib/time";

// Downloads the calls in a date range as an Excel file (served by /calls/export).
export function ExportCalls({ today, day, people, adminId }: { today: string; day: string; people: { id: string; name: string }[]; adminId: string }) {
  const monthStart = `${today.slice(0, 8)}01`;
  const lastMonthEnd = shiftYmd(monthStart, -1);
  const lastMonthStart = `${lastMonthEnd.slice(0, 8)}01`;

  const [open, setOpen] = useState(false);
  const [from, setFrom] = useState(monthStart);
  const [to, setTo] = useState(today);
  const [admin, setAdmin] = useState(adminId);
  const [type, setType] = useState<"full" | "overview">("full");

  const valid = isYmd(from) && isYmd(to) && from <= to;
  const params = new URLSearchParams({ from, to });
  if (admin) params.set("a", admin);
  if (type === "overview") params.set("type", "overview");

  const presets = [
    { label: "This month", from: monthStart, to: today },
    { label: "Last month", from: lastMonthStart, to: lastMonthEnd },
    { label: "Last 7 days", from: shiftYmd(today, -6), to: today },
    { label: "The day shown", from: day, to: day },
  ];

  return (
    <>
      <button type="button" onClick={() => { setAdmin(adminId); setOpen(true); }} className={ghostBtn}>
        <i className="bi bi-file-earmark-excel" aria-hidden="true" /> Export to Excel
      </button>
      <Modal open={open} onClose={() => setOpen(false)} title="Export calls to Excel">
        <div className="space-y-5">
          <div className="flex flex-wrap gap-2" role="group" aria-label="Quick ranges">
            {presets.map((p) => {
              const active = from === p.from && to === p.to;
              return (
                <button key={p.label} type="button" onClick={() => { setFrom(p.from); setTo(p.to); }} aria-pressed={active}
                  className={`rounded-full border px-3.5 py-1.5 text-sm transition ${active ? "border-ice bg-accent/20 text-fg" : "border-line text-muted hover:text-fg"}`}>
                  {p.label}
                </button>
              );
            })}
          </div>

          <fieldset className="space-y-2">
            <legend className="mb-1 text-sm font-medium">What to export</legend>
            {([
              { value: "full", title: "Full report", text: "Every call, plus the day-by-day overview" },
              { value: "overview", title: "Overview only", text: "One row per day with the weekday, calls made, and which days had none" },
            ] as const).map((o) => (
              <label key={o.value} className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 text-sm transition ${type === o.value ? "border-ice bg-accent/10" : "border-line hover:bg-fg/5"}`}>
                <input type="radio" name="ex-type" value={o.value} checked={type === o.value} onChange={() => setType(o.value)} className="mt-0.5 size-4 accent-[#4d40e5]" />
                <span><span className="block font-medium">{o.title}</span><span className="text-muted">{o.text}</span></span>
              </label>
            ))}
          </fieldset>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label htmlFor="ex-from" className="text-sm font-medium">From</label>
              <input id="ex-from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} className={inputClass} />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="ex-to" className="text-sm font-medium">To (included)</label>
              <input id="ex-to" type="date" value={to} onChange={(e) => setTo(e.target.value)} className={inputClass} />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <label htmlFor="ex-admin" className="text-sm font-medium">Caller</label>
              <select id="ex-admin" value={admin} onChange={(e) => setAdmin(e.target.value)} className={inputClass}>
                <option value="">All admins</option>
                {people.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
          </div>

          <p className="text-sm text-muted">
            {valid
              ? <>Calls from <strong className="text-fg">{fmtDayLong(from)}</strong>{from !== to && <> to <strong className="text-fg">{fmtDayLong(to)}</strong></>}. Dates and times are in Pakistan time. {type === "overview" ? "Weekends are shaded grey and weekdays with no calls red." : "The file has a Calls sheet and an Overview sheet (per day and per caller)."}</>
              : "Pick a start date that is on or before the end date."}
          </p>

          <div className="flex justify-end gap-2 border-t border-line pt-4">
            <button type="button" onClick={() => setOpen(false)} className={ghostBtn}>Cancel</button>
            {valid ? (
              <a href={`/calls/export?${params}`} download onClick={() => setTimeout(() => setOpen(false), 300)} className={primaryBtn}>
                <i className="bi bi-download" aria-hidden="true" /> Download .xlsx
              </a>
            ) : (
              <span aria-disabled="true" className={`${primaryBtn} cursor-not-allowed opacity-50`}><i className="bi bi-download" aria-hidden="true" /> Download .xlsx</span>
            )}
          </div>
        </div>
      </Modal>
    </>
  );
}
