import Link from "next/link";
import { getDb } from "@/db";
import { requireAdmin } from "@/lib/auth";
import { fmtPkr, fmtUsd } from "@/lib/money";
import { overviewData } from "@/lib/overview-queries";
import { quoteFor } from "@/lib/quotes";
import { listAdmins } from "@/lib/queries";
import { daysInMonth, fmtMonthLong, isYm, shiftYm, todayYmd } from "@/lib/time";
import { ghostBtn } from "@/components/form-styles";
import { CallsPerDayChart, EarningsChart, Legend, OutcomeDonut, COLORS } from "./charts";

function Delta({ now, prev, label }: { now: number; prev: number; label: string }) {
  if (prev === 0 && now === 0) return <p className="mt-1 text-xs text-muted">Same as {label}</p>;
  if (prev === 0) return <p className="mt-1 text-xs text-emerald-600 dark:text-emerald-300"><i className="bi bi-arrow-up-short" aria-hidden="true" />New since {label}</p>;
  const pct = Math.round(((now - prev) / prev) * 100);
  if (pct === 0) return <p className="mt-1 text-xs text-muted">Level with {label}</p>;
  return (
    <p className={`mt-1 text-xs ${pct > 0 ? "text-emerald-600 dark:text-emerald-300" : "text-red-600 dark:text-red-300"}`}>
      <i className={`bi ${pct > 0 ? "bi-arrow-up-short" : "bi-arrow-down-short"}`} aria-hidden="true" />{Math.abs(pct)}% vs {label}
    </p>
  );
}

export default async function OverviewPage({ searchParams }: { searchParams: Promise<{ m?: string; a?: string }> }) {
  const me = await requireAdmin();
  const sp = await searchParams;
  const today = todayYmd();
  const month = isYm(sp.m) ? sp.m : today.slice(0, 7);
  const people = await listAdmins();
  const adminId = people.some((p) => p.id === sp.a) ? sp.a! : "";
  const d = await overviewData(getDb(), month, adminId);

  // Month progress
  const total = daysInMonth(month);
  const thisMonth = today.slice(0, 7);
  const dayNow = month === thisMonth ? Number(today.slice(8)) : month < thisMonth ? total : 0;
  const left = total - dayNow;
  const pct = Math.round((dayNow / total) * 100);
  const leftText = month < thisMonth ? "Month complete" : month > thisMonth ? `Starts in ${Math.max(1, Math.round((Date.parse(`${month}-01T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86_400_000))} days` : left === 0 ? "Last day of the month" : `${left} day${left === 1 ? "" : "s"} left`;

  const q = (m: string, a = adminId) => `/overview?m=${m}${a ? `&a=${a}` : ""}`;
  const prevName = fmtMonthLong(shiftYm(month, -1)).split(" ")[0];
  const connectRate = d.totalCalls ? Math.round((d.connected / d.totalCalls) * 100) : 0;
  const maxCalls = Math.max(d.totalCalls, 1);

  const kpis = [
    { label: "Calls made", value: String(d.totalCalls), icon: "bi-telephone", delta: <Delta now={d.totalCalls} prev={d.prevCalls} label={prevName} /> },
    { label: "Connect rate", value: `${connectRate}%`, icon: "bi-telephone-inbound", delta: <p className="mt-1 text-xs text-muted">{d.connected} of {d.totalCalls} answered</p> },
    { label: "Meetings booked", value: String(d.booked), icon: "bi-calendar-check", delta: <Delta now={d.booked} prev={d.prevBooked} label={prevName} /> },
    { label: "Meetings held", value: String(d.held), icon: "bi-camera-video", delta: <p className="mt-1 text-xs text-muted">Marked completed</p> },
    { label: "Projects closed", value: String(d.closed), icon: "bi-trophy", delta: <Delta now={d.closed} prev={d.prevClosed} label={prevName} /> },
    { label: "Cash collected", value: fmtUsd(Math.round(d.cashNow.usd * 100)), icon: "bi-cash-coin", delta: <><p className="mt-1 text-xs text-muted">{fmtPkr(d.cashNow.pkr)}</p><Delta now={d.cashNow.usd} prev={d.cashPrev.usd} label={prevName} /></> },
  ];
  const funnel = [
    { label: "Calls made", n: d.totalCalls },
    { label: "Connected", n: d.connected },
    { label: "Meetings booked", n: d.booked },
    { label: "Meetings held", n: d.held },
    { label: "Projects closed", n: d.closed },
  ];

  return (
    <>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold sm:text-3xl">Overview</h1>
          <p className="mt-2 text-sm text-muted">Calls, meetings and earnings for {fmtMonthLong(month)}.</p>
        </div>
        <div className="flex items-center gap-2">
          <Link href={q(shiftYm(month, -1))} aria-label="Previous month" className={`${ghostBtn} !px-3`}><i className="bi bi-chevron-left" aria-hidden="true" /></Link>
          <p className="min-w-36 text-center font-semibold">{fmtMonthLong(month)}</p>
          <Link href={q(shiftYm(month, 1))} aria-label="Next month" className={`${ghostBtn} !px-3`}><i className="bi bi-chevron-right" aria-hidden="true" /></Link>
          {month !== thisMonth && <Link href={q(thisMonth)} className={ghostBtn}>This month</Link>}
        </div>
      </div>

      <section aria-label="Month progress" className="relative mb-6 overflow-hidden rounded-2xl border border-line p-6 sm:p-7"
        style={{ background: "linear-gradient(135deg, var(--surface), var(--bg))", boxShadow: "inset 0 1px 0 var(--line)" }}>
        <span aria-hidden="true" className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-ice to-transparent" />
        <div className="grid items-center gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
          <div>
            <p className="text-sm text-muted">{fmtMonthLong(month).split(" ")[0]} lock-in</p>
            <p className="mt-1 text-3xl font-semibold">{leftText}</p>
            <div className="mt-4 h-2.5 overflow-hidden rounded-full bg-fg/10" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="Month elapsed">
              <div className="h-full rounded-full bg-gradient-to-r from-accent to-ice" style={{ width: `${pct}%` }} />
            </div>
            <p className="mt-2 text-xs text-muted">Day {dayNow} of {total}</p>
          </div>
          <blockquote className="border-l-2 border-ice pl-5 text-lg italic leading-relaxed">{quoteFor(today)}</blockquote>
        </div>
      </section>

      <div className="mb-6 flex flex-wrap gap-2" role="group" aria-label="Filter by admin">
        {[{ id: "", name: "All admins" }, ...people].map((p) => (
          <Link key={p.id || "all"} href={q(month, p.id)} aria-current={adminId === p.id ? "true" : undefined}
            className={`rounded-full border px-3.5 py-1.5 text-sm transition ${adminId === p.id ? "border-ice bg-accent/20 text-fg" : "border-line text-muted hover:text-fg"}`}>
            {p.name}{p.id === me.id ? " (you)" : ""}
          </Link>
        ))}
      </div>

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">
        {kpis.map((k) => (
          <div key={k.label} className="rounded-2xl border border-line bg-surface/60 p-4">
            <p className="flex items-center gap-2 text-sm text-muted"><i className={`bi ${k.icon}`} aria-hidden="true" /> {k.label}</p>
            <p className="mt-2 text-2xl font-semibold">{k.value}</p>
            {k.delta}
          </div>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <section className="rounded-2xl border border-line bg-surface/60 p-5 lg:col-span-2">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-semibold">Calls per day</h2>
            <Legend items={[{ label: "Meeting booked", color: COLORS.meetings }, { label: "Connected", color: COLORS.connected }, { label: "No answer or failed", color: COLORS.missed }]} />
          </div>
          {d.totalCalls === 0 ? <p className="py-16 text-center text-sm text-muted">No calls logged in {fmtMonthLong(month)}.</p> : <CallsPerDayChart data={d.days} />}
        </section>

        <section className="rounded-2xl border border-line bg-surface/60 p-5">
          <h2 className="mb-3 font-semibold">How calls ended</h2>
          {d.totalCalls === 0 ? <p className="py-16 text-center text-sm text-muted">Nothing to show yet.</p> : <OutcomeDonut data={d.outcomeTotals} total={d.totalCalls} />}
        </section>

        <section className="rounded-2xl border border-line bg-surface/60 p-5 lg:col-span-2">
          <div className="mb-3 flex items-baseline justify-between gap-2">
            <h2 className="font-semibold">Cash collected, last 6 months</h2>
            <p className="text-xs text-muted">USD. Hover a bar for PKR.</p>
          </div>
          <EarningsChart data={d.cashMonths} />
        </section>

        <section className="rounded-2xl border border-line bg-surface/60 p-5">
          <h2 className="mb-4 font-semibold">Pipeline this month</h2>
          <ul className="space-y-3">
            {funnel.map((f) => (
              <li key={f.label}>
                <div className="mb-1 flex justify-between text-sm"><span className="text-muted">{f.label}</span><span className="font-medium tabular-nums">{f.n}</span></div>
                <div className="h-2 overflow-hidden rounded-full bg-fg/10"><div className="h-full rounded-full bg-gradient-to-r from-accent to-ice" style={{ width: `${Math.min(100, (f.n / maxCalls) * 100)}%` }} /></div>
              </li>
            ))}
          </ul>
        </section>

        {!adminId && (
          <section className="rounded-2xl border border-line bg-surface/60 p-5 lg:col-span-3">
            <h2 className="mb-4 font-semibold">Admin by admin</h2>
            {d.admins.length === 0 ? <p className="text-sm text-muted">No calls logged this month.</p> : (
              <div className="grid gap-4 sm:grid-cols-2">
                {d.admins.map((a) => (
                  <div key={a.id} className="rounded-xl border border-line p-4">
                    <div className="flex items-baseline justify-between gap-2"><p className="font-medium">{a.name}</p><p className="text-sm text-muted">{a.calls} calls</p></div>
                    <div className="mt-3 flex h-2.5 overflow-hidden rounded-full bg-fg/10" aria-hidden="true">
                      <div style={{ width: `${(a.meetings / Math.max(a.calls, 1)) * 100}%`, background: COLORS.meetings }} />
                      <div style={{ width: `${((a.connected - a.meetings) / Math.max(a.calls, 1)) * 100}%`, background: COLORS.connected }} />
                      <div style={{ width: `${((a.calls - a.connected) / Math.max(a.calls, 1)) * 100}%`, background: COLORS.missed }} />
                    </div>
                    <p className="mt-2 text-xs text-muted">{a.connected} connected · {a.meetings} meetings booked</p>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}
      </div>
    </>
  );
}
