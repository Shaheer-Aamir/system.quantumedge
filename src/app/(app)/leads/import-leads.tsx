"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Papa from "papaparse";
import { Modal } from "@/components/modal";
import { ghostBtn, inputClass, primaryBtn } from "@/components/form-styles";
import { EMAIL_RE, PHONE_RE, normalizePhone } from "@/lib/phone";
import { todayYmd } from "@/lib/time";
import type { ImportRow } from "@/lib/lead-import";
import { importLeadsBatchAction } from "./actions";

type Field = "company" | "contactName" | "phone" | "email" | "notes" | "extra" | "ignore";
const FIELD_LABELS: Record<Field, string> = {
  company: "Company", contactName: "Contact name", phone: "Phone number", email: "Email", notes: "Notes",
  extra: "Keep as extra detail", ignore: "Do not import",
};
const CORE: Field[] = ["company", "contactName", "phone", "email", "notes"];
const RULES: [Field, RegExp][] = [
  ["email", /e-?mail/i],
  ["phone", /phone|mobile|cell|whatsapp|\btel\b|telephone|contact\s*(no|number)/i],
  ["company", /company|business|organi[sz]ation|firm|agency|store|account/i],
  ["contactName", /^(full\s*)?name$|contact|person|owner|first\s*name|decision/i],
  ["notes", /note|comment|remark|description/i],
];
const MAX_ROWS = 10_000;
const BATCH = 100;

function autoMap(headers: string[]): Field[] {
  const used = new Set<Field>();
  return headers.map((h) => {
    for (const [f, re] of RULES) if (!used.has(f) && re.test(h)) { used.add(f); return f; }
    return "extra";
  });
}

function cellToString(v: unknown): string {
  if (v === null || v === undefined) return "";
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (typeof v === "number") return v.toLocaleString("fullwide", { useGrouping: false, maximumFractionDigits: 10 });
  return String(v).trim();
}

async function parseFile(file: File): Promise<string[][]> {
  const name = file.name.toLowerCase();
  if (name.endsWith(".csv")) {
    return new Promise((resolve, reject) =>
      Papa.parse<string[]>(file, {
        skipEmptyLines: "greedy",
        complete: (r) => resolve(r.data.map((row) => row.map(cellToString))),
        error: (e) => reject(e),
      }),
    );
  }
  if (name.endsWith(".xlsx")) {
    const { readSheet } = await import("read-excel-file/browser");
    const data = await readSheet(file);
    return data.map((row) => row.map(cellToString)).filter((row) => row.some(Boolean));
  }
  throw new Error("Please choose a .xlsx or .csv file. Older .xls files need to be saved as .xlsx first.");
}

type Totals = { imported: number; duplicates: number; invalid: number; invalidRows: number[] };

function ImportWizard({ people, onClose }: { people: { id: string; name: string }[]; onClose: () => void }) {
  const router = useRouter();
  const [step, setStep] = useState<"pick" | "map" | "run" | "done">("pick");
  const [fileName, setFileName] = useState("");
  const [headers, setHeaders] = useState<string[]>([]);
  const [data, setData] = useState<string[][]>([]);
  const [mapping, setMapping] = useState<Field[]>([]);
  const [assign, setAssign] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [totals, setTotals] = useState<Totals>({ imported: 0, duplicates: 0, invalid: 0, invalidRows: [] });
  const fileRef = useRef<HTMLInputElement>(null);

  async function handleFile(file: File | undefined) {
    if (!file) return;
    setError("");
    setBusy(true);
    try {
      const grid = await parseFile(file);
      if (grid.length < 2) throw new Error("The file needs a header row and at least one row of leads.");
      if (grid.length - 1 > MAX_ROWS) throw new Error(`Import up to ${MAX_ROWS.toLocaleString()} leads at a time. Split this file and try again.`);
      const head = grid[0].map((h, i) => h || `Column ${i + 1}`);
      setHeaders(head);
      setData(grid.slice(1));
      setMapping(autoMap(head));
      setFileName(file.name);
      setStep("map");
    } catch (e) {
      setError(e instanceof Error ? e.message : "That file could not be read.");
    } finally {
      setBusy(false);
    }
  }

  const prepared = useMemo(() => {
    const idx = (f: Field) => mapping.indexOf(f);
    const phoneCol = idx("phone");
    const seen = new Set<string>();
    const toSend: ImportRow[] = [];
    const invalidRows: number[] = [];
    let repeated = 0;
    let invalid = 0;
    data.forEach((r, i) => {
      const get = (f: Field) => (idx(f) >= 0 ? (r[idx(f)] ?? "").trim() : "");
      const phone = phoneCol >= 0 ? (r[phoneCol] ?? "").trim() : "";
      const hasName = !!(get("company") || get("contactName"));
      if (!PHONE_RE.test(phone) || !hasName) { invalid++; if (invalidRows.length < 20) invalidRows.push(i + 1); return; }
      const norm = normalizePhone(phone);
      if (seen.has(norm)) { repeated++; return; }
      seen.add(norm);
      const extra: Record<string, string> = {};
      mapping.forEach((f, c) => { if (f === "extra" && r[c]) extra[headers[c]] = r[c]; });
      toSend.push({ n: i + 1, company: get("company"), contactName: get("contactName"), phone, email: EMAIL_RE.test(get("email")) ? get("email") : "", notes: get("notes"), extra, assignTo: "" });
    });
    return { toSend, invalidRows, repeated, invalid };
  }, [data, mapping, headers]);

  const duplicateCore = CORE.filter((f) => mapping.filter((m) => m === f).length > 1);
  const hasPhone = mapping.includes("phone");
  const problem = !hasPhone ? "Choose which column holds the phone number." : duplicateCore.length ? `Only one column can be used for ${FIELD_LABELS[duplicateCore[0]].toLowerCase()}.` : "";

  async function run() {
    setStep("run");
    setError("");
    const ids = people.map((p) => p.id);
    const rows = prepared.toSend.map((r, i) => ({ ...r, assignTo: assign === "split" ? ids[i % ids.length] : assign }));
    const t: Totals = { imported: 0, duplicates: prepared.repeated, invalid: prepared.invalid, invalidRows: prepared.invalidRows };
    for (let i = 0; i < rows.length; i += BATCH) {
      const res = await importLeadsBatchAction(rows.slice(i, i + BATCH));
      if (res.error) { setError(res.error); break; }
      t.imported += res.imported;
      t.duplicates += res.duplicates;
      t.invalid += res.invalid;
      setProgress(Math.min(rows.length, i + BATCH));
    }
    setTotals(t);
    setStep("done");
    router.refresh();
  }

  if (step === "pick") {
    return (
      <div className="space-y-4">
        <div role="button" tabIndex={0}
          onClick={() => fileRef.current?.click()}
          onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && fileRef.current?.click()}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => { e.preventDefault(); handleFile(e.dataTransfer.files[0]); }}
          className="flex cursor-pointer flex-col items-center rounded-2xl border border-dashed border-line px-6 py-12 text-center transition hover:border-ice focus-visible:outline-2 focus-visible:outline-ice">
          <span className="flex size-14 items-center justify-center rounded-2xl bg-accent/15 text-2xl text-ice"><i className="bi bi-file-earmark-spreadsheet" aria-hidden="true" /></span>
          <p className="mt-4 font-medium">{busy ? "Reading file" : "Choose a file or drop it here"}</p>
          <p className="mt-1 text-sm text-muted">Excel (.xlsx) or CSV. The first row must contain column names.</p>
        </div>
        <input ref={fileRef} type="file" accept=".xlsx,.csv" className="hidden" onChange={(e) => { handleFile(e.target.files?.[0]); e.target.value = ""; }} />
        {error && <p role="alert" className="text-sm text-red-600 dark:text-red-300">{error}</p>}
      </div>
    );
  }

  if (step === "map") {
    return (
      <div className="space-y-5">
        <p className="text-sm text-muted"><i className="bi bi-file-earmark-spreadsheet mr-2" aria-hidden="true" />{fileName} · {data.length.toLocaleString()} rows. Check that each column is matched correctly.</p>
        <div className="max-h-72 overflow-auto rounded-xl border border-line">
          <table className="w-full min-w-[34rem] text-left text-sm">
            <thead className="sticky top-0 bg-bg text-xs text-muted"><tr><th className="px-3 py-2 font-medium">Column in file</th><th className="px-3 py-2 font-medium">Example</th><th className="px-3 py-2 font-medium">Import as</th></tr></thead>
            <tbody>
              {headers.map((h, c) => (
                <tr key={c} className="border-t border-line">
                  <td className="px-3 py-2 font-medium">{h}</td>
                  <td className="max-w-[12rem] truncate px-3 py-2 text-muted">{data.slice(0, 5).map((r) => r[c]).find(Boolean) ?? ""}</td>
                  <td className="px-3 py-2">
                    <select aria-label={`Import ${h} as`} value={mapping[c]} onChange={(e) => setMapping((m) => m.map((x, i) => (i === c ? (e.target.value as Field) : x)))} className={`${inputClass} !py-1.5`}>
                      {(Object.keys(FIELD_LABELS) as Field[]).map((f) => <option key={f} value={f}>{FIELD_LABELS[f]}</option>)}
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="space-y-1.5">
          <label htmlFor="assign" className="text-sm font-medium">Assign imported leads to</label>
          <select id="assign" value={assign} onChange={(e) => setAssign(e.target.value)} className={inputClass}>
            <option value="">Nobody for now</option>
            {people.length > 1 && <option value="split">Split evenly between all admins</option>}
            {people.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>

        <ul className="space-y-1 rounded-xl bg-surface/60 p-4 text-sm">
          <li><i className="bi bi-check-circle mr-2 text-emerald-500" aria-hidden="true" /><strong>{prepared.toSend.length.toLocaleString()}</strong> leads ready to import</li>
          {prepared.repeated > 0 && <li className="text-muted"><i className="bi bi-files mr-2" aria-hidden="true" />{prepared.repeated} repeated phone numbers in the file will be skipped</li>}
          {prepared.invalid > 0 && <li className="text-muted"><i className="bi bi-exclamation-triangle mr-2" aria-hidden="true" />{prepared.invalid} rows lack a valid phone number or a company or contact name (data rows {prepared.invalidRows.join(", ")}{prepared.invalid > prepared.invalidRows.length ? " and more" : ""})</li>}
          <li className="text-muted"><i className="bi bi-info-circle mr-2" aria-hidden="true" />Numbers already in your leads are skipped automatically</li>
        </ul>

        {problem && <p role="alert" className="text-sm text-red-600 dark:text-red-300">{problem}</p>}
        <div className="flex justify-between gap-3">
          <button type="button" onClick={() => setStep("pick")} className={ghostBtn}>Choose another file</button>
          <button type="button" disabled={!!problem || prepared.toSend.length === 0} onClick={run} className={primaryBtn}>Import {prepared.toSend.length.toLocaleString()} leads</button>
        </div>
      </div>
    );
  }

  if (step === "run") {
    const pct = prepared.toSend.length ? Math.round((progress / prepared.toSend.length) * 100) : 100;
    return (
      <div className="space-y-4 py-6" aria-live="polite">
        <p className="font-medium">Importing leads</p>
        <div className="h-2.5 overflow-hidden rounded-full bg-fg/10"><div className="h-full rounded-full bg-gradient-to-r from-accent to-ice transition-all" style={{ width: `${pct}%` }} /></div>
        <p className="text-sm text-muted">{progress.toLocaleString()} of {prepared.toSend.length.toLocaleString()}. Keep this window open.</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <span className="flex size-12 items-center justify-center rounded-2xl bg-emerald-500/15 text-2xl text-emerald-600 dark:text-emerald-300"><i className="bi bi-check2-circle" aria-hidden="true" /></span>
        <div>
          <p className="text-lg font-semibold">{totals.imported.toLocaleString()} leads imported</p>
          <p className="text-sm text-muted">{totals.duplicates} duplicates skipped · {totals.invalid} rows skipped as incomplete</p>
        </div>
      </div>
      {error && <p role="alert" className="text-sm text-red-600 dark:text-red-300">{error} Some leads may not have been imported.</p>}
      <div className="flex flex-wrap justify-end gap-3">
        <button type="button" onClick={onClose} className={ghostBtn}>Done</button>
        {totals.imported > 0 && (
          <button type="button" onClick={() => { router.push(`/leads?date=${todayYmd()}`); onClose(); }} className={primaryBtn}>View today&apos;s leads</button>
        )}
      </div>
    </div>
  );
}

export function ImportLeads({ people }: { people: { id: string; name: string }[] }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={primaryBtn}><i className="bi bi-upload" aria-hidden="true" /> Import leads</button>
      <Modal open={open} onClose={() => setOpen(false)} title="Import leads" wide>
        <ImportWizard people={people} onClose={() => setOpen(false)} />
      </Modal>
    </>
  );
}
