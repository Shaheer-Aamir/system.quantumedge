"use client";

import { useState } from "react";
import { Modal } from "@/components/modal";
import { fmtPkr, fmtUsd } from "@/lib/money";
import { PROJECT_STATUSES, projectStatusMeta } from "@/lib/project-status";
import { ProjectDetail, type ProjectRow } from "./project-detail";

export function ProjectsTable({ rows, people, rate }: { rows: ProjectRow[]; people: { id: string; name: string }[]; rate: number | null }) {
  const [tab, setTab] = useState("all");
  const [openId, setOpenId] = useState<string | null>(null);
  const shown = tab === "all" ? rows : rows.filter((r) => r.status === tab);
  const open = rows.find((r) => r.id === openId) ?? null;

  return (
    <>
      <div className="mb-4 flex flex-wrap gap-2" role="group" aria-label="Filter by status">
        {[{ value: "all", label: "All" }, ...PROJECT_STATUSES].map((s) => (
          <button key={s.value} type="button" onClick={() => setTab(s.value)} aria-pressed={tab === s.value}
            className={`rounded-full border px-3.5 py-1.5 text-sm transition ${tab === s.value ? "border-ice bg-accent/20 text-fg" : "border-line text-muted hover:text-fg"}`}>
            {s.label}{s.value === "all" ? ` (${rows.length})` : ` (${rows.filter((r) => r.status === s.value).length})`}
          </button>
        ))}
      </div>

      {shown.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-line px-6 py-14 text-center">
          <p className="font-medium">No projects here yet</p>
          <p className="mt-1 text-sm text-muted">Add a project to start tracking what you have collected.</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-line bg-surface/40">
          <table className="w-full min-w-[52rem] text-left text-sm">
            <thead className="border-b border-line text-xs text-muted">
              <tr>{["Project", "Status", "Closed by", "Total", "Upfront", "Collected", "Remaining"].map((h) => <th key={h} className="px-4 py-3 font-medium">{h}</th>)}</tr>
            </thead>
            <tbody>
              {shown.map((r) => {
                const s = projectStatusMeta(r.status);
                const remaining = Math.max(r.agreedCents - r.collectedCents, 0);
                return (
                  <tr key={r.id} className="border-b border-line last:border-0 transition hover:bg-fg/5">
                    <td className="px-4 py-3">
                      <button type="button" onClick={() => setOpenId(r.id)} className="text-left focus-visible:outline-2 focus-visible:outline-ice">
                        <span className="block font-medium hover:text-ice">{r.name}</span>
                        {r.client && <span className="block text-xs text-muted">{r.client}</span>}
                      </button>
                    </td>
                    <td className="px-4 py-3"><span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${s.tone}`}>{s.label}</span></td>
                    <td className="px-4 py-3 text-muted">{r.ownerName}</td>
                    <td className="px-4 py-3 tabular-nums">{fmtUsd(r.agreedCents)}</td>
                    <td className="px-4 py-3 tabular-nums">
                      {r.upfrontCents ? <><span className="block">{fmtUsd(r.upfrontCents)}</span><span className={`block text-xs ${r.collectedCents >= r.upfrontCents ? "text-emerald-600 dark:text-emerald-300" : "text-amber-600 dark:text-amber-300"}`}>{r.collectedCents >= r.upfrontCents ? "Received" : "Due"}</span></> : <span className="text-muted">None</span>}
                    </td>
                    <td className="px-4 py-3 tabular-nums"><span className="block font-medium">{fmtUsd(r.collectedCents)}</span><span className="block text-xs text-muted">{fmtPkr(r.collectedPkr)}</span></td>
                    <td className="px-4 py-3 tabular-nums text-muted">{r.agreedCents ? fmtUsd(remaining) : "None set"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <Modal open={!!open} onClose={() => setOpenId(null)} title={open?.name ?? "Project"} wide>
        {open && <ProjectDetail key={open.id} project={open} people={people} rate={rate} onClose={() => setOpenId(null)} />}
      </Modal>
    </>
  );
}
