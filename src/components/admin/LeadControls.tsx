"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Lead } from "@/db/schema";
import { LEAD_STATUSES, STATUS_META } from "@/components/admin/status";
import { addLeadNote, assignLead, updateLeadStatus } from "@/app/admin/actions";

export function StatusSelect({
  leadId,
  current,
}: {
  leadId: string;
  current: Lead["status"];
}) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  return (
    <div className="flex flex-wrap gap-2">
      {LEAD_STATUSES.map((status) => {
        const meta = STATUS_META[status];
        const active = current === status;
        return (
          <button
            key={status}
            type="button"
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                await updateLeadStatus(leadId, status);
                router.refresh();
              })
            }
            className={`press rounded-full px-3.5 py-2 text-xs font-semibold ring-1 transition-all disabled:opacity-50 ${
              active
                ? "scale-105 bg-ink-900 text-white ring-ink-900 shadow-sm"
                : `${meta.badge} hover:opacity-80`
            }`}
            aria-pressed={active}
          >
            {meta.label}
          </button>
        );
      })}
    </div>
  );
}

export function AssignSelect({
  leadId,
  current,
  team,
}: {
  leadId: string;
  current: string | null;
  team: { id: string; name: string }[];
}) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  return (
    <select
      defaultValue={current ?? ""}
      disabled={pending}
      onChange={(e) =>
        startTransition(async () => {
          await assignLead(leadId, e.target.value || null);
          router.refresh();
        })
      }
      className="rounded-xl border border-ink-200 bg-white px-3 py-2.5 text-sm font-medium disabled:opacity-50"
    >
      <option value="">Unassigned</option>
      {team.map((member) => (
        <option key={member.id} value={member.id}>
          {member.name}
        </option>
      ))}
    </select>
  );
}

export function NoteForm({ leadId }: { leadId: string }) {
  const [note, setNote] = useState("");
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!note.trim()) return;
        startTransition(async () => {
          const result = await addLeadNote(leadId, note);
          if (result.ok) {
            setNote("");
            router.refresh();
          }
        });
      }}
      className="flex gap-2"
    >
      <input
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="Add a note for the team…"
        className="flex-1 rounded-xl border border-ink-200 bg-white px-4 py-2.5 text-sm focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
      />
      <button
        type="submit"
        disabled={pending || !note.trim()}
        className="press rounded-xl bg-brand-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-800 disabled:opacity-50"
      >
        {pending ? "…" : "Add note"}
      </button>
    </form>
  );
}
