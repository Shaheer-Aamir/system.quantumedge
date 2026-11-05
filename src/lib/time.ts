// All dates are stored as UTC milliseconds and displayed in Pakistan time (no daylight saving).
export const TZ = "Asia/Karachi";
export const TZ_OFFSET_MS = 5 * 60 * 60 * 1000;
const DAY = 86_400_000;

export const ymdOf = (ms: number) => new Date(ms + TZ_OFFSET_MS).toISOString().slice(0, 10);
export const todayYmd = () => ymdOf(Date.now());
// Rejects impossible dates such as 2026-02-30, which JavaScript would otherwise roll over to 2 March.
export const isYmd = (s?: string | null): s is string => {
  if (!s || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const t = Date.parse(`${s}T00:00:00Z`);
  return !Number.isNaN(t) && new Date(t).toISOString().slice(0, 10) === s;
};
export const isYm = (s?: string | null): s is string => !!s && /^\d{4}-(0[1-9]|1[0-2])$/.test(s);

export function dayRange(ymd: string) {
  const start = Date.parse(`${ymd}T00:00:00Z`) - TZ_OFFSET_MS;
  return [start, start + DAY] as const;
}
export const shiftYmd = (ymd: string, days: number) => new Date(Date.parse(`${ymd}T00:00:00Z`) + days * DAY).toISOString().slice(0, 10);

export function monthRange(ym: string) {
  const [y, m] = ym.split("-").map(Number);
  return [Date.UTC(y, m - 1, 1) - TZ_OFFSET_MS, Date.UTC(y, m, 1) - TZ_OFFSET_MS] as const;
}
export function shiftYm(ym: string, delta: number) {
  const [y, m] = ym.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1 + delta, 1)).toISOString().slice(0, 7);
}

// "YYYY-MM-DDTHH:mm" (datetime-local value, read as Pakistan time) <-> UTC milliseconds
export function localInputToMs(value: string) {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value);
  if (!m) return null;
  return Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]) - TZ_OFFSET_MS;
}
export const msToLocalInput = (ms: number) => new Date(ms + TZ_OFFSET_MS).toISOString().slice(0, 16);

export const fmtTime = (ms: number) => new Intl.DateTimeFormat("en-US", { timeZone: TZ, hour: "numeric", minute: "2-digit" }).format(ms);
export const fmtDateTime = (ms: number) =>
  new Intl.DateTimeFormat("en-US", { timeZone: TZ, weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(ms);
export const fmtDayLong = (ymd: string) =>
  new Intl.DateTimeFormat("en-US", { timeZone: "UTC", weekday: "long", month: "long", day: "numeric", year: "numeric" }).format(Date.parse(`${ymd}T00:00:00Z`));
export const fmtMonthLong = (ym: string) =>
  new Intl.DateTimeFormat("en-US", { timeZone: "UTC", month: "long", year: "numeric" }).format(Date.parse(`${ym}-01T00:00:00Z`));

export function daysInMonth(ym: string) {
  const [y, m] = ym.split("-").map(Number);
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}
export const fmtMonthShort = (ym: string) =>
  new Intl.DateTimeFormat("en-US", { timeZone: "UTC", month: "short" }).format(Date.parse(`${ym}-01T00:00:00Z`));
