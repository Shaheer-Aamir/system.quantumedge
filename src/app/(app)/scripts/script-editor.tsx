"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { ScriptView } from "@/components/script-view";
import { ghostBtn, inputClass, primaryBtn } from "@/components/form-styles";
import { fmtDateTime } from "@/lib/time";
import { deleteScriptAction, saveScriptAction } from "./actions";

export type ScriptItem = {
  id: string; name: string; content: string; updatedAt: number; updatedBy: string; canDelete: boolean;
};

type Props = {
  script: ScriptItem;
  onSaved: (id: string, patch: { name: string; content: string; updatedAt: number }) => void;
  onDeleted: (id: string) => void;
  onDirty: (dirty: boolean) => void;
};

export function ScriptEditor({ script, onSaved, onDeleted, onDirty }: Props) {
  const [base, setBase] = useState({ name: script.name, content: script.content, updatedAt: script.updatedAt });
  const [name, setName] = useState(script.name);
  const [content, setContent] = useState(script.content);
  const [mode, setMode] = useState<"edit" | "read">(script.content ? "read" : "edit");
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const [pending, start] = useTransition();
  const area = useRef<HTMLTextAreaElement>(null);
  const dirty = name !== base.name || content !== base.content;

  useEffect(() => {
    onDirty(dirty);
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty, onDirty]);

  function save() {
    if (!dirty || pending) return;
    setError("");
    start(async () => {
      const res = await saveScriptAction(script.id, { name, content, expectedUpdatedAt: base.updatedAt });
      if (res.error || !res.updatedAt) { setError(res.error ?? "Could not save."); return; }
      setBase({ name: name.trim(), content, updatedAt: res.updatedAt });
      setName(name.trim());
      onSaved(script.id, { name: name.trim(), content, updatedAt: res.updatedAt });
    });
  }

  function edit(fn: (value: string, s: number, e: number) => { text: string; from: number; to: number }) {
    const el = area.current;
    if (!el) return;
    const r = fn(content, el.selectionStart, el.selectionEnd);
    setContent(r.text);
    requestAnimationFrame(() => { el.focus(); el.setSelectionRange(r.from, r.to); });
  }
  const wrap = (before: string, after: string) => edit((v, s, e) => ({
    text: v.slice(0, s) + before + v.slice(s, e) + after + v.slice(e), from: s + before.length, to: e + before.length,
  }));
  const prefixLines = (prefix: string) => edit((v, s, e) => {
    const start = v.lastIndexOf("\n", s - 1) + 1;
    const block = v.slice(start, e).split("\n").map((l) => prefix + l).join("\n");
    return { text: v.slice(0, start) + block + v.slice(e), from: s + prefix.length, to: start + block.length };
  });

  async function copy() {
    await navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  const tool = "rounded-lg px-2.5 py-1.5 text-sm text-muted transition hover:bg-fg/5 hover:text-fg focus-visible:outline-2 focus-visible:outline-ice";

  return (
    <div className="flex min-h-[32rem] flex-col rounded-2xl border border-line bg-surface/40">
      <div className="flex flex-wrap items-center gap-3 border-b border-line p-4">
        <label htmlFor="script-name" className="sr-only">Script name</label>
        <input id="script-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} className={`${inputClass} !w-auto min-w-[12rem] flex-1 font-medium`} />
        <div className="flex gap-2">
          <button type="button" onClick={() => setMode(mode === "edit" ? "read" : "edit")} className={ghostBtn}>
            <i className={`bi ${mode === "edit" ? "bi-book" : "bi-pencil"}`} aria-hidden="true" /> {mode === "edit" ? "Read view" : "Edit"}
          </button>
          <button type="button" onClick={copy} className={ghostBtn}><i className={`bi ${copied ? "bi-check2" : "bi-clipboard"}`} aria-hidden="true" /> {copied ? "Copied" : "Copy"}</button>
          <button type="button" onClick={save} disabled={!dirty || pending} className={primaryBtn}>{pending ? "Saving" : "Save"}</button>
        </div>
      </div>

      {mode === "edit" ? (
        <>
          <div className="flex flex-wrap items-center gap-1 border-b border-line px-3 py-2" role="toolbar" aria-label="Formatting">
            <button type="button" className={tool} onClick={() => prefixLines("# ")} aria-label="Heading"><i className="bi bi-type-h1" aria-hidden="true" /></button>
            <button type="button" className={tool} onClick={() => prefixLines("## ")} aria-label="Subheading"><i className="bi bi-type-h2" aria-hidden="true" /></button>
            <button type="button" className={tool} onClick={() => wrap("**", "**")} aria-label="Bold"><i className="bi bi-type-bold" aria-hidden="true" /></button>
            <button type="button" className={tool} onClick={() => prefixLines("- ")} aria-label="Bullet list"><i className="bi bi-list-ul" aria-hidden="true" /></button>
            <button type="button" className={tool} onClick={() => prefixLines("> ")} aria-label="Words to say"><i className="bi bi-chat-quote" aria-hidden="true" /></button>
            <span className="ml-auto hidden text-xs text-muted sm:inline">Use &gt; for lines you say out loud</span>
          </div>
          <textarea ref={area} value={content} onChange={(e) => setContent(e.target.value)}
            onKeyDown={(e) => { if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") { e.preventDefault(); save(); } }}
            aria-label="Script text" placeholder="Write your script here. Start a line with > for exact words to say."
            className="min-h-[22rem] flex-1 resize-y bg-transparent p-5 text-[15px] leading-relaxed outline-none placeholder:text-muted/60" />
        </>
      ) : (
        <div className="flex-1 p-6">{content.trim() ? <ScriptView text={content} /> : <p className="text-sm text-muted">This script is empty. Switch to Edit to write it.</p>}</div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line px-4 py-3 text-xs text-muted">
        <span aria-live="polite">
          {error ? <span className="text-red-600 dark:text-red-300">{error}</span> : dirty ? "Unsaved changes" : `Saved ${fmtDateTime(base.updatedAt)} by ${script.updatedBy}`}
          {" · "}{content.trim() ? content.trim().split(/\s+/).length : 0} words
        </span>
        {script.canDelete && (
          <button type="button" disabled={pending}
            onClick={() => window.confirm(`Delete "${base.name}"? This cannot be undone.`) && start(async () => {
              const res = await deleteScriptAction(script.id);
              if (res.error) setError(res.error); else onDeleted(script.id);
            })}
            className="flex items-center gap-1.5 rounded-lg px-2 py-1 text-red-600 transition hover:bg-red-500/10 dark:text-red-300">
            <i className="bi bi-trash3" aria-hidden="true" /> Delete script
          </button>
        )}
      </div>
    </div>
  );
}
