"use client";

import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis, type TooltipContentProps } from "recharts";

const MUTED = "var(--muted)";
const tick = { fill: MUTED, fontSize: 12 };
export const COLORS = { connected: "var(--ice)", meetings: "#34d399", missed: "#64748b" };
const OUTCOME_COLORS: Record<string, string> = {
  no_answer: "#64748b", failed: "#f87171", not_interested: "#fbbf24", follow_up: "var(--ice)", meeting_booked: "#34d399",
};

function Tip({ active, payload, label, prefix, money }: TooltipContentProps & { prefix?: string; money?: boolean }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-line bg-bg px-3 py-2 text-sm shadow-xl">
      {label !== undefined && <p className="mb-1 font-medium">{prefix}{label}</p>}
      {payload.map((p) => (
        <p key={String(p.dataKey ?? p.name)} className="flex items-center gap-2 text-muted">
          <span className="size-2 rounded-full" style={{ background: p.color ?? (p.payload as { fill?: string })?.fill }} />
          {p.name}: <span className="font-medium text-fg">{money ? `$${Number(p.value).toLocaleString("en-US")}` : String(p.value)}</span>
        </p>
      ))}
      {money && payload[0]?.payload?.pkr !== undefined && (
        <p className="mt-1 text-xs text-muted">PKR {Math.round(payload[0].payload.pkr).toLocaleString("en-US")}</p>
      )}
    </div>
  );
}

export function Legend({ items }: { items: { label: string; color: string }[] }) {
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
      {items.map((i) => <li key={i.label} className="flex items-center gap-1.5"><span className="size-2.5 rounded-sm" style={{ background: i.color }} />{i.label}</li>)}
    </ul>
  );
}

export function CallsPerDayChart({ data }: { data: { label: string; connected: number; meetings: number; missed: number }[] }) {
  return (
    <div role="img" aria-label="Bar chart of calls made each day of the month">
      <ResponsiveContainer width="100%" height={280}>
        <BarChart data={data} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke="var(--line)" />
          <XAxis dataKey="label" tickLine={false} axisLine={false} tick={tick} interval="preserveStartEnd" />
          <YAxis allowDecimals={false} tickLine={false} axisLine={false} tick={tick} />
          <Tooltip cursor={{ fill: "var(--line)" }} content={(p) => <Tip {...p} prefix="Day " />} />
          <Bar dataKey="meetings" name="Meeting booked" stackId="c" fill={COLORS.meetings} />
          <Bar dataKey="connected" name="Connected" stackId="c" fill={COLORS.connected} />
          <Bar dataKey="missed" name="No answer or failed" stackId="c" fill={COLORS.missed} radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function OutcomeDonut({ data, total }: { data: { value: string; label: string; n: number }[]; total: number }) {
  const shown = data.filter((d) => d.n > 0);
  return (
    <div>
      <div className="relative" role="img" aria-label="Donut chart of call outcomes">
        <ResponsiveContainer width="100%" height={220}>
          <PieChart>
            <Tooltip content={(p) => <Tip {...p} />} />
            <Pie data={shown} dataKey="n" nameKey="label" innerRadius={62} outerRadius={92} paddingAngle={2} stroke="none">
              {shown.map((d) => <Cell key={d.value} fill={OUTCOME_COLORS[d.value]} />)}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <p className="text-3xl font-semibold">{total}</p>
          <p className="text-xs text-muted">calls</p>
        </div>
      </div>
      <Legend items={data.map((d) => ({ label: `${d.label} (${d.n})`, color: OUTCOME_COLORS[d.value] }))} />
    </div>
  );
}

export function EarningsChart({ data }: { data: { label: string; usd: number; pkr: number }[] }) {
  return (
    <div role="img" aria-label="Bar chart of cash collected in USD over the last six months">
      <ResponsiveContainer width="100%" height={240}>
        <BarChart data={data} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke="var(--line)" />
          <XAxis dataKey="label" tickLine={false} axisLine={false} tick={tick} />
          <YAxis tickLine={false} axisLine={false} tick={tick} tickFormatter={(v) => `$${v}`} />
          <Tooltip cursor={{ fill: "var(--line)" }} content={(p) => <Tip {...p} money />} />
          <Bar dataKey="usd" name="Collected" fill="var(--accent)" radius={[6, 6, 0, 0]}>
            {data.map((_, i) => <Cell key={i} fill={i === data.length - 1 ? "var(--ice)" : "var(--accent)"} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
