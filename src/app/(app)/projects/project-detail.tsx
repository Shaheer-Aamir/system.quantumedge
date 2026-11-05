"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { ghostBtn, inputClass, primaryBtn } from "@/components/form-styles";
import { fmtPkr, fmtUsd, pkrOf } from "@/lib/money";
import { todayYmd, ymdOf } from "@/lib/time";
import { addPaymentAction, deletePaymentAction, deleteProjectAction, getProjectPaymentsAction, updatePaymentAction, updateProjectAction, type PaymentInput } from "./actions";
import { ProjectFields } from "./project-form";

export type ProjectRow = {
  id: string; name: string; client: string | null; status: string; agreedCents: number; upfrontCents: number; collectedCents: number; collectedPkr: number;
  lastPaidAt: number | null; startedAt: number | null; ownerId: string | null; ownerName: string; notes: string | null; canManage: boolean;
};
type Pay = Awaited<ReturnType<typeof getProjectPaymentsAction>>[number];

const dateText = (ms: number) => new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Karachi", month: "short", day: "numeric", year: "numeric" }).format(ms);

function PaymentFields({ value, onChange }: { value: PaymentInput; onChange: (v: PaymentInput) => void }) {
  return (
    <div className="grid gap-3 sm:grid-cols-4">
      <div className="space-y-1.5">
        <label className="text-xs text-muted">Amount (USD)</label>
        <input inputMode="decimal" value={value.amount} onChange={(e) => onChange({ ...value, amount: e.target.value })} className={inputClass} aria-label="Amount in USD" />
      </div>
      <div className="space-y-1.5">
        <label className="text-xs text-muted">Date received</label>
        <input type="date" value={value.date} max={todayYmd()} onChange={(e) => onChange({ ...value, date: e.target.value })} className={inputClass} aria-label="Date received" />
      </div>
      <div className="space-y-1.5">
        <label className="text-xs text-muted">PKR per USD</label>
        <input inputMode="decimal" value={value.rate} onChange={(e) => onChange({ ...value, rate: e.target.value })} className={inputClass} aria-label="PKR per USD" />
      </div>
      <div className="space-y-1.5">
        <label className="text-xs text-muted">Note</label>
        <input value={value.note} maxLength={300} onChange={(e) => onChange({ ...value, note: e.target.value })} className={inputClass} aria-label="Note" />
      </div>
    </div>
  );
}

export function ProjectDetail({ project: p, people, rate, onClose }: {
  project: ProjectRow; people: { id: string; name: string }[]; rate: number | null; onClose: () => void;
}) {
  const [form, setForm] = useState({
    name: p.name, client: p.client ?? "", status: p.status, agreed: p.agreedCents ? String(p.agreedCents / 100) : "",
    upfront: p.upfrontCents ? String(p.upfrontCents / 100) : "",
    startedOn: p.startedAt ? ymdOf(p.startedAt) : "", ownerId: p.ownerId ?? people[0]?.id ?? "", notes: p.notes ?? "",
  });
  const [pays, setPays] = useState<Pay[] | null>(null);
  const blank: PaymentInput = { amount: "", date: todayYmd(), rate: rate ? String(rate) : "", note: "" };
  const [pay, setPay] = useState<PaymentInput>(blank);
  const [editId, setEditId] = useState<string | null>(null);
  const [edit, setEdit] = useState<PaymentInput>(blank);
  const [error, setError] = useState("");
  const [payError, setPayError] = useState("");
  const [pending, start] = useTransition();

  const load = useCallback(() => { getProjectPaymentsAction(p.id).then(setPays).catch(() => setPays([])); }, [p.id]);
  useEffect(load, [load]);

  const collected = pays ? pays.reduce((s, x) => s + x.amountCents, 0) : p.collectedCents;
  const remaining = p.agreedCents - collected;
  const upfrontDue = Math.max(p.upfrontCents - collected, 0);
  const pct = p.agreedCents > 0 ? Math.min(100, Math.round((collected / p.agreedCents) * 100)) : 0;

  const tiles = [
    { label: "Total project amount", value: fmtUsd(p.agreedCents), sub: p.agreedCents ? `Balance after upfront: ${fmtUsd(Math.max(p.agreedCents - p.upfrontCents, 0))}` : "Not set" },
    { label: "Charged upfront", value: fmtUsd(p.upfrontCents), sub: p.upfrontCents === 0 ? "None set" : upfrontDue === 0 ? "Received" : `${fmtUsd(upfrontDue)} still due` },
    { label: "Collected so far", value: fmtUsd(collected), sub: pays ? `${pays.length} payment${pays.length === 1 ? "" : "s"}` : "Loading" },
    { label: remaining < 0 ? "Collected over the total" : "Remaining", value: fmtUsd(Math.abs(remaining)), sub: p.agreedCents ? `${pct}% collected` : "Set a total amount" },
  ];

  const run = (fn: () => Promise<{ error?: string }>, onOk: () => void, setErr: (m: string) => void) => {
    setErr("");
    start(async () => { const r = await fn(); if (r.error) setErr(r.error); else onOk(); });
  };

  return (
    <div className="space-y-7">
      <section aria-label="Money summary" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {tiles.map((t) => (
          <div key={t.label} className="rounded-2xl border border-line bg-surface/60 p-4">
            <p className="text-xs text-muted">{t.label}</p>
            <p className="mt-1 text-xl font-semibold">{t.value}</p>
            <p className="mt-0.5 text-xs text-muted">{t.sub}</p>
          </div>
        ))}
      </section>
      {p.agreedCents > 0 && <div className="-mt-3 h-2 overflow-hidden rounded-full bg-fg/10"><div className="h-full rounded-full bg-gradient-to-r from-accent to-ice" style={{ width: `${pct}%` }} /></div>}

      <section aria-labelledby="pay-h">
        <h3 id="pay-h" className="mb-3 font-semibold">Cash collected</h3>
        {!pays ? <p className="text-sm text-muted">Loading</p> : pays.length === 0 ? <p className="text-sm text-muted">No payments recorded yet.</p> : (
          <ul className="space-y-2">
            {pays.map((x) => (
              <li key={x.id} className="rounded-xl border border-line p-3 text-sm">
                {editId === x.id ? (
                  <div className="space-y-3">
                    <PaymentFields value={edit} onChange={setEdit} />
                    <div className="flex flex-wrap items-center justify-end gap-2">
                      {payError && <p role="alert" className="mr-auto text-sm text-red-600 dark:text-red-300">{payError}</p>}
                      <button type="button" className={ghostBtn} onClick={() => { setEditId(null); setPayError(""); }}>Cancel</button>
                      <button type="button" disabled={pending} className={primaryBtn}
                        onClick={() => run(() => updatePaymentAction(x.id, edit), () => { setEditId(null); load(); }, setPayError)}>Save payment</button>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="font-medium">{fmtUsd(x.amountCents)} <span className="font-normal text-muted">· {fmtPkr(pkrOf(x.amountCents, x.rate))} at {x.rate}</span></p>
                      <p className="text-xs text-muted">{dateText(x.receivedAt)} · added by {x.addedBy}{x.note ? ` · ${x.note}` : ""}</p>
                    </div>
                    {p.canManage && (
                      <div className="flex gap-1">
                        <button type="button" aria-label="Edit payment" className="rounded-lg p-2 text-muted hover:bg-fg/5 hover:text-fg"
                          onClick={() => { setPayError(""); setEditId(x.id); setEdit({ amount: String(x.amountCents / 100), date: ymdOf(x.receivedAt), rate: String(x.rate), note: x.note ?? "" }); }}>
                          <i className="bi bi-pencil" aria-hidden="true" />
                        </button>
                        <button type="button" aria-label="Delete payment" disabled={pending}
                          onClick={() => window.confirm("Delete this payment?") && start(async () => { await deletePaymentAction(x.id); load(); })}
                          className="rounded-lg p-2 text-muted hover:bg-red-500/10 hover:text-red-500"><i className="bi bi-trash3" aria-hidden="true" /></button>
                      </div>
                    )}
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}

        {p.canManage && (
          <div className="mt-4 rounded-2xl border border-line bg-surface/50 p-4">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-medium">Record a payment</p>
              {upfrontDue > 0 && (
                <button type="button" className="text-sm text-ice hover:underline" onClick={() => setPay({ ...pay, amount: String(upfrontDue / 100), note: "Upfront payment" })}>
                  Fill in the upfront ({fmtUsd(upfrontDue)})
                </button>
              )}
            </div>
            <PaymentFields value={pay} onChange={setPay} />
            <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
              <p className="text-xs text-muted">{Number(pay.amount.replace(/,/g, "")) > 0 && Number(pay.rate) > 0 ? `About ${fmtPkr(Number(pay.amount.replace(/,/g, "")) * Number(pay.rate))}` : ""}</p>
              <button type="button" disabled={pending} className={ghostBtn}
                onClick={() => run(() => addPaymentAction(p.id, pay), () => { setPay({ ...pay, amount: "", note: "" }); load(); }, setPayError)}>
                <i className="bi bi-plus-lg" aria-hidden="true" /> Add payment
              </button>
            </div>
            {editId === null && payError && <p role="alert" className="mt-2 text-sm text-red-600 dark:text-red-300">{payError}</p>}
          </div>
        )}
      </section>

      {p.canManage ? (
        <section className="space-y-4 border-t border-line pt-6">
          <h3 className="font-semibold">Project details</h3>
          <ProjectFields value={form} onChange={setForm} people={people} />
          <div className="flex justify-end">
            <button type="button" disabled={pending} className={primaryBtn}
              onClick={() => run(() => updateProjectAction(p.id, form), onClose, setError)}>{pending ? "Saving" : "Save project"}</button>
          </div>
          {error && <p role="alert" className="text-sm text-red-600 dark:text-red-300">{error}</p>}
        </section>
      ) : (
        <p className="rounded-xl bg-surface/60 p-3 text-sm text-muted">Only the project owner or the super admin can edit this project.</p>
      )}

      {p.canManage && (
        <div className="flex justify-end border-t border-line pt-4">
          <button type="button" disabled={pending}
            onClick={() => window.confirm(`Delete "${p.name}" and all its payments? This cannot be undone.`) && run(() => deleteProjectAction(p.id), onClose, setError)}
            className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm text-red-600 transition hover:bg-red-500/10 dark:text-red-300">
            <i className="bi bi-trash3" aria-hidden="true" /> Delete project
          </button>
        </div>
      )}
    </div>
  );
}
