"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Avatar } from "./avatar";
import { Logo } from "./logo";
import { ThemeToggle } from "./theme-toggle";
import { logoutAction } from "@/app/(app)/actions";

const NAV = [
  { href: "/overview", label: "Overview", icon: "bi-grid-1x2" },
  { href: "/calls", label: "Daily calls", icon: "bi-telephone" },
  { href: "/calendar", label: "Meetings", icon: "bi-calendar-event" },
  { href: "/leads", label: "Leads", icon: "bi-people" },
  { href: "/scripts", label: "Scripts", icon: "bi-journal-text" },
  { href: "/projects", label: "Projects and earnings", icon: "bi-briefcase" },
  { href: "/settings", label: "Settings", icon: "bi-gear" },
];

type Props = {
  admin: { name: string; roleLabel: string; avatar: string | null };
  theme: "dark" | "light";
};

export function Sidebar({ admin, theme }: Props) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <>
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-line bg-bg/90 px-5 py-3 backdrop-blur lg:hidden">
        <Logo height={30} />
        <button type="button" onClick={() => setOpen(true)} aria-label="Open menu"
          className="rounded-lg p-2 text-2xl text-fg focus-visible:outline-2 focus-visible:outline-ice">
          <i className="bi bi-list" aria-hidden="true" />
        </button>
      </header>

      {open && (
        <button type="button" aria-label="Close menu" onClick={() => setOpen(false)}
          className="fixed inset-0 z-40 bg-black/60 lg:hidden" />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-72 flex-col border-r border-line bg-bg px-4 py-6 transition-transform duration-200 lg:translate-x-0 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
        style={{ backgroundImage: "radial-gradient(ellipse 120% 40% at 0% 0%, var(--glow), transparent 70%)" }}
      >
        <div className="relative flex flex-col items-center gap-2 px-2 text-center">
          <Logo height={48} />
          <p className="text-xs text-muted">Cold Calling Tracker</p>
          <button type="button" onClick={() => setOpen(false)} aria-label="Close menu"
            className="absolute right-0 top-0 rounded-lg p-2 text-xl text-muted hover:text-fg lg:hidden">
            <i className="bi bi-x-lg" aria-hidden="true" />
          </button>
        </div>

        <nav className="mt-8 flex-1 space-y-1" aria-label="Main">
          {NAV.map((item) => {
            const active = pathname === item.href || pathname.startsWith(item.href + "/");
            return (
              <Link key={item.href} href={item.href} onClick={() => setOpen(false)}
                aria-current={active ? "page" : undefined}
                className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition focus-visible:outline-2 focus-visible:outline-ice ${
                  active ? "bg-accent/20 text-fg" : "text-muted hover:bg-fg/5 hover:text-fg"
                }`}>
                <i className={`bi ${item.icon} text-lg ${active ? "text-ice" : ""}`} aria-hidden="true" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="space-y-1 border-t border-line pt-4">
          <ThemeToggle initial={theme} />
          <form action={logoutAction}>
            <button type="submit"
              className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-muted transition hover:bg-fg/5 hover:text-fg focus-visible:outline-2 focus-visible:outline-ice">
              <i className="bi bi-box-arrow-right text-lg" aria-hidden="true" /> Log out
            </button>
          </form>
          <div className="mt-3 flex items-center gap-3 rounded-xl bg-surface/70 p-3">
            <Avatar name={admin.name} src={admin.avatar} size={40} />
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{admin.name}</p>
              <p className="truncate text-xs text-muted">{admin.roleLabel}</p>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}
