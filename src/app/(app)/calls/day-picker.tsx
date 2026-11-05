"use client";

import { useRouter } from "next/navigation";

export function DayPicker({ day, adminId }: { day: string; adminId: string }) {
  const router = useRouter();
  return (
    <input type="date" value={day} aria-label="Pick a day"
      onChange={(e) => e.target.value && router.push(`/calls?d=${e.target.value}${adminId ? `&a=${adminId}` : ""}`)}
      className="rounded-xl border border-line bg-bg/60 px-3 py-2 text-sm outline-none focus:border-ice focus-visible:ring-2 focus-visible:ring-ice/40" />
  );
}
