"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { LEAD_STATUSES } from "@/lib/lead-status";
import { PAGE_SIZES, SORTS, type LeadFilters } from "@/lib/lead-queries";

const selectClass =
  "rounded-xl border border-line bg-bg/60 px-3 py-2.5 text-sm outline-none focus:border-ice focus-visible:ring-2 focus-visible:ring-ice/40";

export type DayCounts = { today: string; todayCount: number; yesterday: string; yesterdayCount: number };

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick} aria-pressed={active}
      className={`flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-sm transition focus-visible:outline-2 focus-visible:outline-ice ${
        active ? "border-ice bg-accent/20 text-fg" : "border-line text-muted hover:text-fg"
      }`}>
      {children}
    </button>
  );
}

export function LeadsToolbar({ filters, people, days }: { filters: LeadFilters; people: { id: string; name: string }[]; days: DayCounts }) {
  const router = useRouter();
  const [q, setQ] = useState(filters.q);
  const first = useRef(true);

  function go(next: Partial<LeadFilters>) {
    const f = { ...filters, q, ...next, page: 1 };
    const params = new URLSearchParams();
    if (f.q) params.set("q", f.q);
    if (f.date) params.set("date", f.date);
    if (f.status) params.set("status", f.status);
    if (f.assigned) params.set("assigned", f.assigned);
    if (f.sort !== "newest") params.set("sort", f.sort);
    if (f.size !== PAGE_SIZES[0]) params.set("size", String(f.size));
    router.replace(`/leads${params.size ? `?${params}` : ""}`);
  }

  useEffect(() => {
    if (first.current) { first.current = false; return; }
    const t = setTimeout(() => go({ q }), 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center gap-2" role="group" aria-label="Filter by the day leads were imported">
        <span className="mr-1 text-sm text-muted">Imported on</span>
        <Chip active={!filters.date} onClick={() => go({ date: "" })}>All leads</Chip>
        <Chip active={filters.date === days.today} onClick={() => go({ date: days.today })}>
          Today <span className="text-xs text-muted">{days.todayCount}</span>
        </Chip>
        <Chip active={filters.date === days.yesterday} onClick={() => go({ date: days.yesterday })}>
          Yesterday <span className="text-xs text-muted">{days.yesterdayCount}</span>
        </Chip>
        <label className="sr-only" htmlFor="import-date">Pick an import date</label>
        <input id="import-date" type="date" value={filters.date} max={days.today}
          onChange={(e) => go({ date: e.target.value })}
          className={`${selectClass} ${filters.date && filters.date !== days.today && filters.date !== days.yesterday ? "border-ice bg-accent/20" : ""}`} />
      </div>

      <div className="mb-5 flex flex-wrap items-center gap-3">
        <div className="relative min-w-[14rem] flex-1">
          <i className="bi bi-search absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" aria-hidden="true" />
          <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search company, name, phone or email"
            aria-label="Search leads" className="w-full rounded-xl border border-line bg-bg/60 py-2.5 pl-10 pr-4 text-sm outline-none focus:border-ice focus-visible:ring-2 focus-visible:ring-ice/40" />
        </div>
        <select aria-label="Filter by status" value={filters.status} onChange={(e) => go({ status: e.target.value })} className={selectClass}>
          <option value="">All statuses</option>
          {LEAD_STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>
        <select aria-label="Filter by assigned admin" value={filters.assigned} onChange={(e) => go({ assigned: e.target.value })} className={selectClass}>
          <option value="">Anyone</option>
          <option value="none">Unassigned</option>
          {people.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <select aria-label="Sort leads" value={filters.sort} onChange={(e) => go({ sort: e.target.value })} className={selectClass}>
          {SORTS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>
        <select aria-label="Leads per page" value={filters.size} onChange={(e) => go({ size: Number(e.target.value) })} className={selectClass}>
          {PAGE_SIZES.map((n) => <option key={n} value={n}>{n} per page</option>)}
        </select>
      </div>
    </>
  );
}
