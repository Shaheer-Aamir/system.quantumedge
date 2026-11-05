"use client";

import { useEffect, useId, useRef, useState } from "react";
import type { LeadHit } from "@/lib/lead-hit";
import { leadStatusMeta } from "@/lib/lead-status";
import { outcomeMeta } from "@/lib/outcomes";
import { inputClass } from "./form-styles";

type FieldName = "company" | "contactName" | "phone";
type Values = { company: string; contactName: string; phone: string; email: string };

const fromHit = (h: LeadHit | null | undefined): Values => ({ company: h?.company ?? "", contactName: h?.contactName ?? "", phone: h?.phone ?? "", email: h?.email ?? "" });
const callsText = (h: LeadHit) =>
  h.callCount === 0 ? "No calls yet" : `${h.callCount} call${h.callCount === 1 ? "" : "s"}${h.lastOutcome ? `, last: ${outcomeMeta(h.lastOutcome).label.toLowerCase()}` : ""}`;

// The lead fields for the call and meeting forms. Typing in company, contact or phone suggests existing leads.
// Picking one fills the form and submits its id, so no duplicate lead is created.
export function LeadPickerView({ search, preselected }: { search: (term: string) => Promise<LeadHit[]>; preselected?: LeadHit | null }) {
  const uid = useId();
  const [selected, setSelected] = useState<LeadHit | null>(preselected ?? null);
  const [values, setValues] = useState<Values>(fromHit(preselected));
  const [active, setActive] = useState<FieldName | null>(null);
  const [hits, setHits] = useState<LeadHit[]>([]);
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(-1);
  const latest = useRef(0);
  const companyRef = useRef<HTMLInputElement>(null);
  const term = active ? values[active] : "";

  useEffect(() => {
    if (selected || !active || term.trim().length < 2) { setHits([]); return; }
    const mine = ++latest.current;
    const timer = setTimeout(async () => {
      try {
        const found = await search(term);
        if (mine === latest.current) { setHits(found); setHighlight(-1); }
      } catch {
        if (mine === latest.current) setHits([]);
      }
    }, 200);
    return () => clearTimeout(timer);
  }, [term, active, selected, search]);

  function choose(hit: LeadHit) {
    latest.current++;
    setSelected(hit);
    setValues(fromHit(hit));
    setHits([]);
    setOpen(false);
  }
  function clear() {
    latest.current++;
    setSelected(null);
    setValues({ company: "", contactName: "", phone: "", email: "" });
    setHits([]);
    setTimeout(() => companyRef.current?.focus(), 0);
  }

  function onKeyDown(e: React.KeyboardEvent) {
    const showing = open && hits.length > 0;
    if (!showing) return;
    if (e.key === "ArrowDown") { e.preventDefault(); setHighlight((h) => (h + 1) % hits.length); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setHighlight((h) => (h <= 0 ? hits.length - 1 : h - 1)); }
    else if (e.key === "Enter" && highlight >= 0) { e.preventDefault(); choose(hits[highlight]); }
    else if (e.key === "Escape") { e.stopPropagation(); setOpen(false); } // close the list, not the dialog
  }

  const listId = `${uid}-list`;
  const showList = open && hits.length > 0 && !selected;

  function field(name: FieldName | "email", label: string, opts: { required?: boolean; type?: string; align?: "left" | "right"; optional?: boolean; inputRef?: React.Ref<HTMLInputElement> } = {}) {
    const suggests = name !== "email";
    const here = showList && active === name;
    return (
      <div className="relative space-y-1.5">
        <label htmlFor={`${uid}-${name}`} className="text-sm font-medium">{label}{opts.optional && <span className="font-normal text-muted"> (optional)</span>}</label>
        <input
          id={`${uid}-${name}`} name={name} type={opts.type ?? "text"} ref={opts.inputRef} value={values[name]} required={opts.required}
          readOnly={!!selected} autoComplete="off" spellCheck={false}
          onChange={(e) => { setValues((v) => ({ ...v, [name]: e.target.value })); setOpen(true); }}
          onFocus={() => { if (suggests) { setActive(name as FieldName); setOpen(true); } }}
          onBlur={() => setOpen(false)}
          onKeyDown={suggests ? onKeyDown : undefined}
          {...(suggests ? { role: "combobox", "aria-autocomplete": "list" as const, "aria-expanded": here, "aria-controls": listId, "aria-activedescendant": here && highlight >= 0 ? `${uid}-opt-${highlight}` : undefined } : {})}
          className={`${inputClass} ${selected ? "cursor-default bg-surface/60 text-muted" : ""}`}
        />
        {here && (
          <ul id={listId} role="listbox" aria-label="Matching leads"
            className={`absolute z-30 mt-1 max-h-72 w-full overflow-auto rounded-xl border border-line bg-bg p-1 shadow-2xl sm:w-[26rem] ${opts.align === "right" ? "sm:right-0" : "left-0"}`}>
            {hits.map((h, i) => {
              const s = leadStatusMeta(h.status);
              return (
                <li key={h.id} id={`${uid}-opt-${i}`} role="option" aria-selected={i === highlight}
                  onMouseDown={(e) => { e.preventDefault(); choose(h); }} onMouseEnter={() => setHighlight(i)}
                  className={`cursor-pointer rounded-lg px-3 py-2.5 ${i === highlight ? "bg-accent/25" : "hover:bg-fg/5"}`}>
                  <div className="flex items-center justify-between gap-3">
                    <span className="truncate font-medium">{h.company || h.contactName}</span>
                    <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ${s.tone}`}>{s.label}</span>
                  </div>
                  <p className="truncate text-xs text-muted">{h.company && h.contactName ? `${h.contactName} · ` : ""}{h.phone}</p>
                  <p className="text-xs text-muted">{callsText(h)}</p>
                </li>
              );
            })}
            <li role="presentation" className="px-3 py-2 text-xs text-muted">Not listed? Keep typing to add a new lead.</li>
          </ul>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <input type="hidden" name="leadId" value={selected?.id ?? ""} />
      <div className="grid gap-4 sm:grid-cols-2">
        {field("company", "Company", { inputRef: companyRef })}
        {field("contactName", "Contact name", { align: "right" })}
        {field("phone", "Phone number", { required: true, type: "tel" })}
        {field("email", "Email", { type: "email", optional: true })}
      </div>
      {selected ? (
        <div role="status" className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-ice/50 bg-accent/15 px-4 py-3 text-sm">
          <p><i className="bi bi-person-check mr-2 text-ice" aria-hidden="true" />Existing lead selected. {callsText(selected)}.</p>
          <button type="button" onClick={clear} className="font-medium text-ice hover:underline">Use a different lead</button>
        </div>
      ) : (
        <p className="text-xs text-muted">Start typing a company, contact or phone number to find a lead you already have.</p>
      )}
    </div>
  );
}
