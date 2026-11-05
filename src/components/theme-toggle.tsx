"use client";

import { useState } from "react";

export function ThemeToggle({ initial }: { initial: "dark" | "light" }) {
  const [theme, setTheme] = useState(initial);

  function toggle() {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    document.documentElement.dataset.theme = next;
    document.cookie = `qe_theme=${next}; path=/; max-age=31536000; samesite=lax`;
  }

  return (
    <button type="button" onClick={toggle}
      className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-muted transition hover:bg-fg/5 hover:text-fg focus-visible:outline-2 focus-visible:outline-ice">
      <i className={`bi ${theme === "dark" ? "bi-sun" : "bi-moon-stars"} text-lg`} aria-hidden="true" />
      {theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
    </button>
  );
}
