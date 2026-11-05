// USD is stored as whole cents. PKR is calculated from the rate saved with each payment.
export const RATE_KEY = "usd_pkr_rate";

export function parseMoneyToCents(input: string): number | null {
  const s = input.replace(/[$,\s]/g, "");
  if (!/^\d+(\.\d{1,2})?$/.test(s)) return null;
  const cents = Math.round(parseFloat(s) * 100);
  return cents <= 1_000_000_000 ? cents : null; // up to $10,000,000
}

export function parseRate(input: string): number | null {
  const s = input.replace(/[,\s]/g, "");
  if (!/^\d+(\.\d{1,4})?$/.test(s)) return null;
  const n = parseFloat(s);
  return n >= 1 && n <= 10_000 ? n : null;
}

export const fmtUsd = (cents: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: cents % 100 === 0 ? 0 : 2 }).format(cents / 100);
export const fmtPkr = (pkr: number) => `PKR ${Math.round(pkr).toLocaleString("en-US")}`;
export const pkrOf = (cents: number, rate: number) => (cents / 100) * rate;
