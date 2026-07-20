import { asc } from "drizzle-orm";
import { db } from "@/db";
import { providers } from "@/db/schema";
import { formatDateTime } from "@/components/admin/status";
import { ProviderEditor } from "@/components/admin/ProviderEditor";

export const dynamic = "force-dynamic";

const STATUS_BADGE: Record<string, string> = {
  active: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  delisted: "bg-amber-50 text-amber-700 ring-amber-200",
  hidden: "bg-ink-100 text-ink-500 ring-ink-200",
};

export default async function AdminProvidersPage() {
  const rows = await db.select().from(providers).orderBy(asc(providers.name));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-ink-900">
          Providers{" "}
          <span className="text-base font-medium text-ink-400">({rows.length})</span>
        </h1>
        <p className="mt-1 text-sm text-ink-500">
          Directory entries are refreshed automatically from the official list. Edits made
          here are preserved across refreshes.
        </p>
      </div>

      <ul className="space-y-3">
        {rows.map((p) => (
          <li
            key={p.id}
            className="grid grid-cols-[1fr_auto] items-start gap-3 rounded-2xl border border-ink-100 bg-white p-4"
          >
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-semibold text-ink-900">{p.name}</p>
                <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ${STATUS_BADGE[p.status]}`}>
                  {p.status}
                </span>
                {p.missingScrapeCount > 0 && (
                  <span className="rounded-full bg-rose-50 px-2 py-0.5 text-[11px] font-semibold text-rose-600 ring-1 ring-rose-200">
                    missing in last {p.missingScrapeCount} refresh{p.missingScrapeCount > 1 ? "es" : ""}
                  </span>
                )}
                {Object.keys((p.adminOverrides as Record<string, boolean>) ?? {}).length > 0 && (
                  <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-[11px] font-semibold text-indigo-600 ring-1 ring-indigo-200">
                    manual edits
                  </span>
                )}
              </div>
              <p className="mt-0.5 truncate text-xs text-ink-500">
                /{p.slug}
                {p.website ? ` · ${p.website}` : ""} · source: {p.source}
                {p.lastSeenInScrapeAt
                  ? ` · last seen ${formatDateTime(p.lastSeenInScrapeAt)}`
                  : ""}
              </p>
            </div>
            <ProviderEditor
              provider={{
                id: p.id,
                name: p.name,
                nameAr: p.nameAr,
                website: p.website,
                description: p.description,
                descriptionAr: p.descriptionAr,
                status: p.status,
                slug: p.slug,
              }}
            />
          </li>
        ))}
      </ul>
    </div>
  );
}
