"use client";

import { useState } from "react";

export function AppearanceCard({ initial }: { initial: "dark" | "light" }) {
  const [theme, setTheme] = useState(initial);
  function choose(next: "dark" | "light") {
    setTheme(next);
    document.documentElement.dataset.theme = next;
    document.cookie = `qe_theme=${next}; path=/; max-age=31536000; samesite=lax`;
  }
  return (
    <div role="radiogroup" aria-label="Theme" className="flex flex-wrap gap-3">
      {([["dark", "Dark", "bi-moon-stars"], ["light", "Light", "bi-sun"]] as const).map(([value, label, icon]) => (
        <button key={value} type="button" role="radio" aria-checked={theme === value} onClick={() => choose(value)}
          className={`flex items-center gap-3 rounded-xl border px-5 py-3 text-sm font-medium transition focus-visible:outline-2 focus-visible:outline-ice ${theme === value ? "border-ice bg-accent/20" : "border-line text-muted hover:text-fg"}`}>
          <i className={`bi ${icon} text-lg`} aria-hidden="true" /> {label}
        </button>
      ))}
    </div>
  );
}
