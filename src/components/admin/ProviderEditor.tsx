"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateProviderAdmin } from "@/app/admin/actions";

interface EditableProvider {
  id: string;
  name: string;
  nameAr: string | null;
  website: string | null;
  description: string | null;
  descriptionAr: string | null;
  status: "active" | "delisted" | "hidden";
  slug: string;
}

export function ProviderEditor({ provider }: { provider: EditableProvider }) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      await updateProviderAdmin(provider.id, {
        nameAr: String(fd.get("nameAr") ?? ""),
        website: String(fd.get("website") ?? ""),
        description: String(fd.get("description") ?? ""),
        descriptionAr: String(fd.get("descriptionAr") ?? ""),
        status: String(fd.get("status")) as EditableProvider["status"],
      });
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="press rounded-lg border border-ink-200 px-3 py-1.5 text-xs font-semibold text-ink-600 hover:border-brand-300 hover:text-brand-800"
      >
        {open ? "Close" : "Edit"}
      </button>
      {open && (
        <form
          onSubmit={onSubmit}
          className="col-span-full mt-3 grid gap-3 rounded-xl border border-brand-100 bg-brand-50/40 p-4 sm:grid-cols-2"
        >
          <label className="text-xs font-semibold text-ink-600">
            Website
            <input
              name="website"
              defaultValue={provider.website ?? ""}
              dir="ltr"
              className="mt-1 w-full rounded-lg border border-ink-200 bg-white px-3 py-2 text-sm font-normal"
            />
          </label>
          <label className="text-xs font-semibold text-ink-600">
            Status
            <select
              name="status"
              defaultValue={provider.status}
              className="mt-1 w-full rounded-lg border border-ink-200 bg-white px-3 py-2 text-sm font-normal"
            >
              <option value="active">Active (on official list)</option>
              <option value="delisted">Delisted (shown with notice)</option>
              <option value="hidden">Hidden (not shown publicly)</option>
            </select>
          </label>
          <label className="text-xs font-semibold text-ink-600">
            Arabic name
            <input
              name="nameAr"
              defaultValue={provider.nameAr ?? ""}
              dir="rtl"
              className="mt-1 w-full rounded-lg border border-ink-200 bg-white px-3 py-2 text-sm font-normal"
            />
          </label>
          <div className="hidden sm:block" />
          <label className="text-xs font-semibold text-ink-600">
            Description (EN)
            <textarea
              name="description"
              rows={3}
              defaultValue={provider.description ?? ""}
              className="mt-1 w-full rounded-lg border border-ink-200 bg-white px-3 py-2 text-sm font-normal"
            />
          </label>
          <label className="text-xs font-semibold text-ink-600">
            Description (AR)
            <textarea
              name="descriptionAr"
              rows={3}
              defaultValue={provider.descriptionAr ?? ""}
              dir="rtl"
              className="mt-1 w-full rounded-lg border border-ink-200 bg-white px-3 py-2 text-sm font-normal"
            />
          </label>
          <div className="col-span-full flex items-center gap-3">
            <button
              type="submit"
              disabled={pending}
              className="press rounded-lg bg-brand-700 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-800 disabled:opacity-50"
            >
              {pending ? "Saving…" : "Save"}
            </button>
            <p className="text-xs text-ink-400">
              Fields you edit here are protected from automatic refreshes.
            </p>
          </div>
        </form>
      )}
    </>
  );
}
