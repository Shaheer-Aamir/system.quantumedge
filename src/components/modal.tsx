"use client";

import { useEffect, useRef } from "react";

type Props = { open: boolean; onClose: () => void; title: string; children: React.ReactNode; wide?: boolean };

export function Modal({ open, onClose, title, children, wide }: Props) {
  const panel = useRef<HTMLDivElement>(null);
  // Parents usually pass a new onClose function on every render. Keeping it in a ref means the
  // effect below only runs when the dialog opens or closes, never while someone is typing.
  const closeRef = useRef(onClose);
  useEffect(() => { closeRef.current = onClose; });

  useEffect(() => {
    if (!open) return;
    const el = panel.current;
    if (el && !el.contains(document.activeElement)) el.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && closeRef.current();
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center sm:items-center sm:p-6">
      <button type="button" aria-label="Close" onClick={onClose} className="absolute inset-0 bg-black/60" />
      <div ref={panel} tabIndex={-1} role="dialog" aria-modal="true" aria-label={title}
        className={`relative max-h-[92vh] w-full overflow-y-auto rounded-t-2xl border border-line bg-bg p-6 shadow-2xl outline-none sm:rounded-2xl ${wide ? "sm:max-w-2xl" : "sm:max-w-lg"}`}>
        <div className="mb-5 flex items-center justify-between gap-4">
          <h2 className="text-lg font-semibold">{title}</h2>
          <button type="button" onClick={onClose} aria-label="Close dialog"
            className="rounded-lg p-1.5 text-xl text-muted hover:text-fg focus-visible:outline-2 focus-visible:outline-ice">
            <i className="bi bi-x-lg" aria-hidden="true" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
