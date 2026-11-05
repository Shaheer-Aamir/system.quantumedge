import Link from "next/link";
import { getDb } from "@/db";
import { requireAdmin } from "@/lib/auth";
import { fmtPkr, fmtUsd } from "@/lib/money";
import { getRate, listProjects, paymentTotals, paymentsInRange } from "@/lib/project-queries";
import { listAdmins } from "@/lib/queries";
import { fmtMonthLong, isYm, monthRange, shiftYm, todayYmd, ymdOf } from "@/lib/time";
import { PageHeader } from "@/components/coming-soon";
import { ghostBtn } from "@/components/form-styles";
import { AddProject } from "./add-project";
import { ProjectsTable } from "./projects-table";
import { RateControl } from "./rate-control";
import type { ProjectRow } from "./project-detail";

export default async function ProjectsPage({ searchParams }: { searchParams: Promise<{ m?: string; a?: string }> }) {
  const me = await requireAdmin();
  const sp = await searchParams;
  const month = isYm(sp.m) ? sp.m : todayYmd().slice(0, 7);
  const people = await listAdmins();
  const ownerId = people.some((p) => p.id === sp.a) ? sp.a! : "";
  const [from, to] = monthRange(month);
  const db = getDb();

  const [rateRow, projectRows, monthTotals, allTotals, monthPays] = await Promise.all([
    getRate(db), listProjects(db, ownerId), paymentTotals(db, ownerId, from, to), paymentTotals(db, ownerId), paymentsInRange(db, ownerId, from, to),
  ]);

  const rows: ProjectRow[] = projectRows.map(({ p, ownerName, ownerUser, collectedCents, collectedPkrCents, lastPaidAt }) => ({
    id: p.id, name: p.name, client: p.client, status: p.status, agreedCents: p.agreedCents, upfrontCents: p.upfrontCents, collectedCents: Number(collectedCents),
    collectedPkr: Number(collectedPkrCents) / 100, lastPaidAt: lastPaidAt ? Number(lastPaidAt) : null, startedAt: p.startedAt, ownerId: p.ownerId,
    ownerName: ownerName ?? ownerUser ?? "Unknown", notes: p.notes,
    canManage: me.role === "super_admin" || p.ownerId === me.id || p.createdBy === me.id,
  }));

  const open = rows.filter((r) => r.status === "ongoing" || r.status === "on_hold");
  const outstanding = open.reduce((s, r) => s + Math.max(r.agreedCents - r.collectedCents, 0), 0);
  const cards = [
    { label: `Collected in ${fmtMonthLong(month)}`, usd: fmtUsd(monthTotals.cents), pkr: fmtPkr(monthTotals.pkr), icon: "bi-cash-coin" },
    { label: "Collected all time", usd: fmtUsd(allTotals.cents), pkr: fmtPkr(allTotals.pkr), icon: "bi-bank" },
    { label: "Still to collect", usd: fmtUsd(outstanding), pkr: rateRow ? fmtPkr((outstanding / 100) * rateRow.rate) : "Set the rate to see PKR", icon: "bi-hourglass-split" },
  ];
  const q = (m: string, a = ownerId) => `/projects?m=${m}${a ? `&a=${a}` : ""}`;

  return (
    <>
      <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <PageHeader title="Projects and earnings" description="Projects you have closed, the money collected in USD, and what it is worth in PKR." />
        <AddProject people={people} meId={me.id} rate={rateRow?.rate ?? null} />
      </div>

      <div className="mb-6"><RateControl rate={rateRow?.rate ?? null} updatedAt={rateRow?.updatedAt ?? null} /></div>

      <div className="mb-6 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <Link href={q(shiftYm(month, -1))} aria-label="Previous month" className={`${ghostBtn} !px-3`}><i className="bi bi-chevron-left" aria-hidden="true" /></Link>
          <p className="min-w-40 text-center font-semibold">{fmtMonthLong(month)}</p>
          <Link href={q(shiftYm(month, 1))} aria-label="Next month" className={`${ghostBtn} !px-3`}><i className="bi bi-chevron-right" aria-hidden="true" /></Link>
          {!todayYmd().startsWith(month) && <Link href={q(todayYmd().slice(0, 7))} className={ghostBtn}>This month</Link>}
        </div>
        <div className="flex flex-wrap gap-2 sm:ml-auto" role="group" aria-label="Filter by admin">
          {[{ id: "", name: "All admins" }, ...people].map((p) => (
            <Link key={p.id || "all"} href={q(month, p.id)} aria-current={ownerId === p.id ? "true" : undefined}
              className={`rounded-full border px-3.5 py-1.5 text-sm transition ${ownerId === p.id ? "border-ice bg-accent/20 text-fg" : "border-line text-muted hover:text-fg"}`}>
              {p.name}{p.id === me.id ? " (you)" : ""}
            </Link>
          ))}
        </div>
      </div>

      <div className="mb-8 grid gap-3 sm:grid-cols-3">
        {cards.map((c) => (
          <div key={c.label} className="rounded-2xl border border-line bg-surface/60 p-5">
            <p className="flex items-center gap-2 text-sm text-muted"><i className={`bi ${c.icon}`} aria-hidden="true" /> {c.label}</p>
            <p className="mt-3 text-3xl font-semibold">{c.usd}</p>
            <p className="mt-1 text-sm text-muted">{c.pkr}</p>
          </div>
        ))}
      </div>

      <ProjectsTable rows={rows} people={people} rate={rateRow?.rate ?? null} />

      <section className="mt-10" aria-labelledby="month-pay">
        <h2 id="month-pay" className="text-lg font-semibold">Payments received in {fmtMonthLong(month)}</h2>
        <p className="mb-4 mt-1 text-sm text-muted">{monthTotals.count} payment{monthTotals.count === 1 ? "" : "s"}</p>
        {monthPays.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-line px-6 py-10 text-center text-sm text-muted">No payments recorded for this month.</p>
        ) : (
          <ul className="space-y-2">
            {monthPays.map(({ pay, project, client, addedBy, addedUser }) => (
              <li key={pay.id} className="flex flex-wrap items-center justify-between gap-x-6 gap-y-1 rounded-2xl border border-line bg-surface/60 px-4 py-3 text-sm">
                <div>
                  <p className="font-medium">{project}{client ? <span className="font-normal text-muted"> · {client}</span> : null}</p>
                  <p className="text-xs text-muted">{ymdOf(pay.receivedAt)} · added by {addedBy ?? addedUser ?? "Unknown"}{pay.note ? ` · ${pay.note}` : ""}</p>
                </div>
                <p className="text-right"><span className="font-semibold">{fmtUsd(pay.amountCents)}</span><span className="block text-xs text-muted">{fmtPkr((pay.amountCents / 100) * pay.rate)} at {pay.rate}</span></p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
