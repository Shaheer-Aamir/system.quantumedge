"use client";

import { useActionState, useState } from "react";
import { loginAction, type LoginState } from "./actions";

const inputClass =
  "w-full rounded-xl border border-line bg-bg/60 py-3 pl-11 pr-4 text-[15px] text-fg placeholder:text-muted/60 " +
  "outline-none transition focus:border-ice focus-visible:ring-2 focus-visible:ring-ice/40";

export function LoginForm() {
  const [state, action, pending] = useActionState<LoginState, FormData>(loginAction, {});
  const [showPassword, setShowPassword] = useState(false);

  return (
    <form action={action} className="space-y-5">
      <div className="space-y-2">
        <label htmlFor="username" className="text-sm font-medium text-fg">Username</label>
        <div className="relative">
          <i className="bi bi-person absolute left-4 top-1/2 -translate-y-1/2 text-lg text-muted" aria-hidden="true" />
          <input id="username" name="username" type="text" autoComplete="username" required autoFocus
            placeholder="Your username" className={inputClass} />
        </div>
      </div>

      <div className="space-y-2">
        <label htmlFor="password" className="text-sm font-medium text-fg">Password</label>
        <div className="relative">
          <i className="bi bi-lock absolute left-4 top-1/2 -translate-y-1/2 text-lg text-muted" aria-hidden="true" />
          <input id="password" name="password" type={showPassword ? "text" : "password"} autoComplete="current-password"
            required placeholder="Your password" className={`${inputClass} pr-12`} />
          <button type="button" onClick={() => setShowPassword((v) => !v)}
            aria-label={showPassword ? "Hide password" : "Show password"}
            className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-muted transition hover:text-fg focus-visible:outline-2 focus-visible:outline-ice">
            <i className={`bi ${showPassword ? "bi-eye-slash" : "bi-eye"} text-lg`} aria-hidden="true" />
          </button>
        </div>
      </div>

      {state.error && (
        <p role="alert" className="flex items-center gap-2 rounded-xl border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          <i className="bi bi-exclamation-circle" aria-hidden="true" />
          {state.error}
        </p>
      )}

      <button type="submit" disabled={pending}
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-ice to-[#c4d8fb] px-5 py-3 text-[15px] font-semibold text-[#08080e] transition hover:brightness-110 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ice disabled:opacity-70">
        {pending ? (
          <><i className="bi bi-arrow-repeat animate-spin" aria-hidden="true" /> Signing in</>
        ) : (
          <>Sign in <i className="bi bi-arrow-right" aria-hidden="true" /></>
        )}
      </button>
    </form>
  );
}
