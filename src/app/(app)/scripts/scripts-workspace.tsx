"use client";

import { useState, useTransition } from "react";
import { primaryBtn } from "@/components/form-styles";
import { fmtDateTime } from "@/lib/time";
import { createScriptAction } from "./actions";
import { ScriptEditor, type ScriptItem } from "./script-editor";

export function ScriptsWorkspace({ initial }: { initial: ScriptItem[] }) {
  const [items, setItems] = useState(initial);
  const [selectedId, setSelectedId] = useState<string | null>(initial[0]?.id ?? null);
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  const selected = items.find((s) => s.id === selectedId) ?? null;

  const select = (id: string) => {
    if (id === selectedId) return;
    if (dirty && !window.confirm("You have unsaved changes in this script. Leave without saving?")) return;
    setDirty(false);
    setSelectedId(id);
  };

  function create() {
    if (dirty && !window.confirm("You have unsaved changes in this script. Leave without saving?")) return;
    setError("");
    start(async () => {
      const res = await createScriptAction();
      if (!res.script) { setError(res.error ?? "Could not create the script."); return; }
      setItems((list) => [...list, { ...res.script!, content: "", canDelete: true }]);
      setDirty(false);
      setSelectedId(res.script.id);
    });
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[18rem_1fr]">
      <aside aria-label="Scripts">
        <button type="button" onClick={create} disabled={pending} className={`${primaryBtn} mb-4 w-full`}>
          <i className="bi bi-plus-lg" aria-hidden="true" /> {pending ? "Creating" : "New script"}
        </button>
        {error && <p role="alert" className="mb-3 text-sm text-red-600 dark:text-red-300">{error}</p>}
        {items.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-line px-4 py-8 text-center text-sm text-muted">No scripts yet. Create your first one.</p>
        ) : (
          <ul className="space-y-2">
            {items.map((s) => (
              <li key={s.id}>
                <button type="button" onClick={() => select(s.id)} aria-current={s.id === selectedId ? "true" : undefined}
                  className={`w-full rounded-xl border p-3 text-left transition focus-visible:outline-2 focus-visible:outline-ice ${
                    s.id === selectedId ? "border-ice bg-accent/20" : "border-line hover:bg-fg/5"
                  }`}>
                  <span className="block truncate font-medium"><i className="bi bi-journal-text mr-2 text-ice" aria-hidden="true" />{s.name}</span>
                  <span className="mt-1 block truncate text-xs text-muted">Edited {fmtDateTime(s.updatedAt)}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </aside>

      {selected ? (
        <ScriptEditor
          key={selected.id}
          script={selected}
          onDirty={setDirty}
          onSaved={(id, patch) => setItems((list) => list.map((s) => (s.id === id ? { ...s, ...patch } : s)))}
          onDeleted={(id) => {
            const rest = items.filter((s) => s.id !== id);
            setItems(rest);
            setDirty(false);
            setSelectedId(rest[0]?.id ?? null);
          }}
        />
      ) : (
        <div className="flex min-h-[20rem] items-center justify-center rounded-2xl border border-dashed border-line text-sm text-muted">
          Select a script or create a new one.
        </div>
      )}
    </div>
  );
}
