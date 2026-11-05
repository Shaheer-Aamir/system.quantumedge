"use client";

import { useActionState, useEffect, useRef } from "react";
import { inputClass, primaryBtn } from "@/components/form-styles";
import { changeMyPasswordAction, type FormState } from "./actions";

export function PasswordCard() {
  const [state, action, pending] = useActionState<FormState, FormData>(changeMyPasswordAction, {});
  const form = useRef<HTMLFormElement>(null);
  useEffect(() => { if (state.ok) form.current?.reset(); }, [state]);

  return (
    <form ref={form} action={action} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="space-y-1.5"><label htmlFor="pw-cur" className="text-sm font-medium">Current password</label>
          <input id="pw-cur" name="current" type="password" autoComplete="current-password" required className={inputClass} /></div>
        <div className="space-y-1.5"><label htmlFor="pw-new" className="text-sm font-medium">New password</label>
          <input id="pw-new" name="next" type="password" autoComplete="new-password" minLength={10} required className={inputClass} /></div>
        <div className="space-y-1.5"><label htmlFor="pw-conf" className="text-sm font-medium">Repeat new password</label>
          <input id="pw-conf" name="confirm" type="password" autoComplete="new-password" minLength={10} required className={inputClass} /></div>
      </div>
      <p className="text-xs text-muted">At least 10 characters. Changing it signs you out of other devices.</p>
      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" disabled={pending} className={primaryBtn}>{pending ? "Saving" : "Change password"}</button>
        {state.ok && <p role="status" className="text-sm text-emerald-600 dark:text-emerald-300"><i className="bi bi-check2" aria-hidden="true" /> Password changed</p>}
        {state.error && <p role="alert" className="text-sm text-red-600 dark:text-red-300">{state.error}</p>}
      </div>
    </form>
  );
}
