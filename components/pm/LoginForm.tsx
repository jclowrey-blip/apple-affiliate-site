"use client";

import { useState, type FormEvent } from "react";
import { loginAction } from "@/lib/pm/auth-actions";
import { runAction } from "./runAction";
import { btnPrimary, fieldClass, labelClass } from "./styles";

export default function LoginForm() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    // On success the action redirects to the dashboard and never returns here.
    const result = await runAction(() => loginAction({ password }));
    setBusy(false);
    if (result && !result.ok) {
      setError(result.error);
      setPassword("");
    }
  }

  return (
    <form onSubmit={submit} className="mx-auto mt-[12vh] max-w-sm space-y-4 rounded-lg border border-line bg-white p-6">
      <h1 className="font-display text-lg text-ink">
        projects<span className="text-accent">.</span>
      </h1>
      <div>
        <label className={labelClass} htmlFor="pm-login-password">
          Password
        </label>
        <input
          id="pm-login-password"
          type="password"
          className={fieldClass}
          value={password}
          autoFocus
          autoComplete="current-password"
          required
          onChange={(e) => setPassword(e.target.value)}
        />
      </div>
      {error && (
        <p role="alert" className="text-sm text-warn">
          {error}
        </p>
      )}
      <button type="submit" className={`${btnPrimary} w-full`} disabled={busy || !password}>
        {busy ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}
