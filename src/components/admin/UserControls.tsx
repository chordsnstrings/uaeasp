"use client";

import { useActionState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createUserAction, toggleUserActive } from "@/app/admin/actions";

export function CreateUserForm() {
  const [state, formAction, pending] = useActionState(createUserAction, undefined);

  return (
    <form action={formAction} className="space-y-3">
      <input
        name="name"
        placeholder="Full name"
        required
        className="w-full rounded-xl border border-ink-200 px-4 py-2.5 text-sm"
      />
      <input
        name="email"
        type="email"
        placeholder="Email"
        required
        className="w-full rounded-xl border border-ink-200 px-4 py-2.5 text-sm"
      />
      <input
        name="password"
        type="password"
        placeholder="Password (min 10 chars)"
        required
        minLength={10}
        className="w-full rounded-xl border border-ink-200 px-4 py-2.5 text-sm"
      />
      <select name="role" defaultValue="sales" className="w-full rounded-xl border border-ink-200 px-3 py-2.5 text-sm">
        <option value="sales">Sales</option>
        <option value="admin">Admin</option>
      </select>
      {state?.error && (
        <p className="rounded-lg bg-red-50 p-2.5 text-xs font-medium text-red-700">{state.error}</p>
      )}
      {state?.ok && (
        <p className="rounded-lg bg-emerald-50 p-2.5 text-xs font-medium text-emerald-700">
          User created.
        </p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="press w-full rounded-xl bg-brand-700 py-2.5 text-sm font-bold text-white hover:bg-brand-800 disabled:opacity-50"
      >
        {pending ? "Creating…" : "Create user"}
      </button>
    </form>
  );
}

export function ToggleActiveButton({ userId, active }: { userId: string; active: boolean }) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          await toggleUserActive(userId);
          router.refresh();
        })
      }
      className={`press rounded-lg border px-3 py-1.5 text-xs font-semibold disabled:opacity-50 ${
        active
          ? "border-ink-200 text-ink-500 hover:border-rose-200 hover:text-rose-600"
          : "border-ink-200 text-ink-500 hover:border-emerald-200 hover:text-emerald-700"
      }`}
    >
      {active ? "Deactivate" : "Reactivate"}
    </button>
  );
}
