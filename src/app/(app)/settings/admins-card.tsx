"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { Avatar } from "@/components/avatar";
import { Modal } from "@/components/modal";
import { ghostBtn, inputClass, primaryBtn } from "@/components/form-styles";
import { fmtDateTime } from "@/lib/time";
import { createAdminAction, resetAdminPasswordAction, setAdminActiveAction, updateAdminAction, type FormState } from "./actions";

export type AdminRow = {
  id: string; username: string; fullName: string | null; email: string | null; phone: string | null; avatar: string | null;
  role: string; isActive: boolean; profileComplete: boolean; createdAt: number;
};

// Easy to read out over a call: no look-alike characters.
function generatePassword() {
  const chars = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = crypto.getRandomValues(new Uint8Array(14));
  return Array.from(bytes, (b) => chars[b % chars.length]).join("");
}

function PasswordField({ id, name, value, onChange }: { id: string; name?: string; value: string; onChange: (v: string) => void }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="text-sm font-medium">Password</label>
      <div className="flex flex-wrap gap-2">
        <input id={id} name={name} value={value} onChange={(e) => onChange(e.target.value)} autoComplete="off" spellCheck={false} minLength={10} required
          className={`${inputClass} !w-auto min-w-[14rem] flex-1 font-mono`} />
        <button type="button" onClick={() => onChange(generatePassword())} className={ghostBtn}><i className="bi bi-magic" aria-hidden="true" /> Generate</button>
        <button type="button" disabled={!value} className={ghostBtn}
          onClick={async () => { await navigator.clipboard.writeText(value); setCopied(true); setTimeout(() => setCopied(false), 1500); }}>
          <i className={`bi ${copied ? "bi-check2" : "bi-clipboard"}`} aria-hidden="true" /> {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <p className="text-xs text-muted">At least 10 characters. Copy it now, because it cannot be viewed again after you save.</p>
    </div>
  );
}

function AddForm({ onDone }: { onDone: () => void }) {
  const [state, action, pending] = useActionState<FormState, FormData>(createAdminAction, {});
  const [password, setPassword] = useState("");
  useEffect(() => { if (state.ok) onDone(); }, [state, onDone]);
  return (
    <form action={action} className="space-y-5">
      <div className="space-y-1.5">
        <label htmlFor="new-user" className="text-sm font-medium">Username</label>
        <input id="new-user" name="username" required autoComplete="off" className={inputClass} />
        <p className="text-xs text-muted">This is what they type to sign in. They add their name, email, phone and photo on first login.</p>
      </div>
      <PasswordField id="new-pass" name="password" value={password} onChange={setPassword} />
      {state.error && <p role="alert" className="text-sm text-red-600 dark:text-red-300">{state.error}</p>}
      <button type="submit" disabled={pending} className={`${primaryBtn} w-full`}>{pending ? "Creating" : "Create admin"}</button>
    </form>
  );
}

function EditForm({ admin, isSelf, onDone }: { admin: AdminRow; isSelf: boolean; onDone: () => void }) {
  const [f, setF] = useState({ username: admin.username, fullName: admin.fullName ?? "", email: admin.email ?? "", phone: admin.phone ?? "" });
  const [pw, setPw] = useState("");
  const [msg, setMsg] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const [pending, start] = useTransition();
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value });
  const run = (fn: () => Promise<{ error?: string }>, ok: string, close = false) => {
    setMsg(null);
    start(async () => {
      const r = await fn();
      if (r.error) setMsg({ kind: "error", text: r.error });
      else { setMsg({ kind: "ok", text: ok }); if (close) onDone(); }
    });
  };
  const canToggle = !isSelf && admin.role !== "super_admin";

  return (
    <div className="space-y-7">
      <section className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5"><label htmlFor="ea-user" className="text-sm font-medium">Username</label><input id="ea-user" value={f.username} onChange={set("username")} className={inputClass} /></div>
          <div className="space-y-1.5"><label htmlFor="ea-name" className="text-sm font-medium">Full name</label><input id="ea-name" value={f.fullName} onChange={set("fullName")} className={inputClass} /></div>
          <div className="space-y-1.5"><label htmlFor="ea-email" className="text-sm font-medium">Email</label><input id="ea-email" type="email" value={f.email} onChange={set("email")} className={inputClass} /></div>
          <div className="space-y-1.5"><label htmlFor="ea-phone" className="text-sm font-medium">Phone number</label><input id="ea-phone" type="tel" value={f.phone} onChange={set("phone")} className={inputClass} /></div>
        </div>
        <button type="button" disabled={pending} onClick={() => run(() => updateAdminAction(admin.id, f), "Details saved")} className={primaryBtn}>Save details</button>
      </section>

      {!isSelf && (
        <section className="space-y-3 border-t border-line pt-6">
          <h3 className="font-semibold">Reset password</h3>
          <PasswordField id="ea-pass" value={pw} onChange={setPw} />
          <button type="button" disabled={pending || pw.length < 10} className={ghostBtn}
            onClick={() => run(async () => { const r = await resetAdminPasswordAction(admin.id, pw); if (!r.error) setPw(""); return r; }, "Password reset. They have been signed out.")}>
            Set new password
          </button>
        </section>
      )}

      {canToggle && (
        <section className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-6">
          <div>
            <h3 className="font-semibold">{admin.isActive ? "Deactivate this admin" : "Reactivate this admin"}</h3>
            <p className="text-sm text-muted">{admin.isActive ? "They are signed out and cannot log in. Their calls and data stay." : "They will be able to log in again."}</p>
          </div>
          <button type="button" disabled={pending} className={ghostBtn}
            onClick={() => (admin.isActive ? window.confirm(`Deactivate ${admin.fullName ?? admin.username}?`) : true) && run(() => setAdminActiveAction(admin.id, !admin.isActive), admin.isActive ? "Deactivated" : "Reactivated", true)}>
            {admin.isActive ? "Deactivate" : "Reactivate"}
          </button>
        </section>
      )}
      {msg && <p role={msg.kind === "error" ? "alert" : "status"} className={`text-sm ${msg.kind === "error" ? "text-red-600 dark:text-red-300" : "text-emerald-600 dark:text-emerald-300"}`}>{msg.text}</p>}
    </div>
  );
}

export function AdminsCard({ admins, meId }: { admins: AdminRow[]; meId: string }) {
  const [adding, setAdding] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const editing = admins.find((a) => a.id === editId) ?? null;

  return (
    <>
      <div className="mb-4 flex justify-end">
        <button type="button" onClick={() => setAdding(true)} className={primaryBtn}><i className="bi bi-person-plus" aria-hidden="true" /> Add admin</button>
      </div>
      <ul className="space-y-2">
        {admins.map((a) => {
          const name = a.fullName ?? a.username;
          return (
            <li key={a.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-2xl border border-line bg-surface/60 p-4">
              <Avatar name={name} src={a.avatar} size={44} />
              <div className="min-w-[10rem] flex-1">
                <p className="font-medium">{name}{a.id === meId ? <span className="font-normal text-muted"> (you)</span> : null}</p>
                <p className="text-sm text-muted">Username: {a.username}{a.email ? ` · ${a.email}` : ""}</p>
                <p className="text-xs text-muted">Added {fmtDateTime(a.createdAt).split(",").slice(0, 2).join(",")}{!a.profileComplete ? " · has not completed their profile" : ""}</p>
              </div>
              <span className={`rounded-full px-3 py-1 text-xs font-medium ${a.role === "super_admin" ? "bg-violet-500/15 text-violet-700 dark:text-violet-300" : "bg-sky-500/10 text-sky-700 dark:text-ice"}`}>{a.role === "super_admin" ? "Super admin" : "Admin"}</span>
              {!a.isActive && <span className="rounded-full bg-red-500/10 px-3 py-1 text-xs font-medium text-red-600 dark:text-red-300">Deactivated</span>}
              <button type="button" onClick={() => setEditId(a.id)} className={ghostBtn}><i className="bi bi-pencil" aria-hidden="true" /> Manage</button>
            </li>
          );
        })}
      </ul>

      <Modal open={adding} onClose={() => setAdding(false)} title="Add an admin"><AddForm onDone={() => setAdding(false)} /></Modal>
      <Modal open={!!editing} onClose={() => setEditId(null)} title={editing ? `Manage ${editing.fullName ?? editing.username}` : "Manage admin"} wide>
        {editing && <EditForm key={editing.id} admin={editing} isSelf={editing.id === meId} onDone={() => setEditId(null)} />}
      </Modal>
    </>
  );
}
