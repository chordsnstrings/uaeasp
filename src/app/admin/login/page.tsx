"use client";

import { useActionState } from "react";
import { loginAction } from "../actions";

export default function AdminLoginPage() {
  const [state, formAction, pending] = useActionState(loginAction, undefined);

  return (
    <div className="grid min-h-dvh place-items-center px-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <span
            aria-hidden
            className="mx-auto grid size-12 place-items-center rounded-2xl bg-brand-700 text-xl font-black text-white"
          >
            ⚡
          </span>
          <h1 className="mt-4 text-xl font-bold text-ink-900">Team sign in</h1>
          <p className="mt-1 text-sm text-ink-500">Lead CRM &amp; directory admin</p>
        </div>

        <form
          action={formAction}
          className="space-y-4 rounded-2xl border border-ink-100 bg-white p-6 shadow-card"
        >
          <div>
            <label htmlFor="email" className="mb-1.5 block text-sm font-semibold text-ink-800">
              Email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              required
              autoComplete="username"
              className="w-full rounded-xl border border-ink-200 px-4 py-3 text-sm focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
            />
          </div>
          <div>
            <label htmlFor="password" className="mb-1.5 block text-sm font-semibold text-ink-800">
              Password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              required
              autoComplete="current-password"
              className="w-full rounded-xl border border-ink-200 px-4 py-3 text-sm focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
            />
          </div>
          {state?.error && (
            <p className="rounded-lg bg-red-50 p-3 text-sm font-medium text-red-700" role="alert">
              {state.error}
            </p>
          )}
          <button
            type="submit"
            disabled={pending}
            className="press w-full rounded-xl bg-brand-700 py-3 font-bold text-white hover:bg-brand-800 disabled:opacity-60"
          >
            {pending ? "Signing in…" : "Sign in"}
          </button>
        </form>
      </div>
    </div>
  );
}
