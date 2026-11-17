import { localNow, type LeadZone } from "@/lib/lead-timezone";

// The lead's local time, shown in the Leads list. Green dot = weekday, 9 AM to 5 PM there.
export function LeadLocalTime({ zone, now }: { zone: LeadZone | null; now: number | null }) {
  if (!zone) {
    return (
      <span className="text-muted" title="Unknown. Mobile numbers have no location: import a City or State column, or use a landline.">
        <span aria-hidden="true">-</span><span className="sr-only">Local time unknown</span>
      </span>
    );
  }
  if (now === null) return <span className="text-muted" aria-hidden="true">...</span>;

  const t = localNow(zone.tz, now);
  const hint = `${t.abbr}${zone.guessed ? ". Guessed from the phone area code, so it can be wrong for mobile-forwarded or VoIP numbers." : ""}`;
  return (
    <div title={hint}>
      <span className="flex items-center gap-1.5 font-medium tabular-nums">
        <span className={`size-2 shrink-0 rounded-full ${t.open ? "bg-emerald-500" : "bg-fg/25"}`} aria-hidden="true" />
        {t.time}
        <span className="sr-only">{t.open ? " (business hours)" : " (outside business hours)"}</span>
      </span>
      <span className="block text-xs text-muted">{t.day} · {zone.place}</span>
    </div>
  );
}
