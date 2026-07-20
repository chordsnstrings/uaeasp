import { asc, eq, ne, sql } from "drizzle-orm";
import { unstable_cache } from "next/cache";
import { db } from "@/db";
import { appSettings, providers, scrapeRuns } from "@/db/schema";
import type { Provider } from "@/db/schema";

export const PROVIDERS_CACHE_TAG = "providers";

/** All providers that should appear in the public directory. */
export const getPublicProviders = unstable_cache(
  async (): Promise<Provider[]> => {
    return db
      .select()
      .from(providers)
      .where(ne(providers.status, "hidden"))
      .orderBy(asc(providers.name));
  },
  ["public-providers"],
  { revalidate: 3600, tags: [PROVIDERS_CACHE_TAG] },
);

export const getActiveProviderCount = unstable_cache(
  async (): Promise<number> => {
    const [row] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(providers)
      .where(eq(providers.status, "active"));
    return row?.count ?? 0;
  },
  ["provider-count"],
  { revalidate: 3600, tags: [PROVIDERS_CACHE_TAG] },
);

export async function getProviderBySlug(slug: string): Promise<Provider | null> {
  const [row] = await db
    .select()
    .from(providers)
    .where(eq(providers.slug, slug))
    .limit(1);
  if (!row || row.status === "hidden") return null;
  return row;
}

/**
 * The public "directory last updated" date (ISO string — unstable_cache
 * serializes values to JSON, so Dates must not cross this boundary): the
 * last successful data refresh if one has happened, otherwise the newest
 * provider update. Deliberately neutral wording everywhere — the mechanism
 * is never exposed.
 */
export const getDirectoryLastUpdated = unstable_cache(
  async (): Promise<string> => {
    const [setting] = await db
      .select()
      .from(appSettings)
      .where(eq(appSettings.key, "last_good_run_id"))
      .limit(1);
    if (setting) {
      const runId = (setting.value as { runId?: string }).runId;
      if (runId) {
        const [run] = await db
          .select({ finishedAt: scrapeRuns.finishedAt })
          .from(scrapeRuns)
          .where(eq(scrapeRuns.id, runId))
          .limit(1);
        if (run?.finishedAt) return run.finishedAt.toISOString();
      }
    }
    const [row] = await db
      .select({
        latest: sql<
          string | null
        >`to_char(max(${providers.updatedAt}) at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"')`,
      })
      .from(providers);
    return row?.latest ?? new Date().toISOString();
  },
  ["directory-last-updated"],
  { revalidate: 3600, tags: [PROVIDERS_CACHE_TAG] },
);

export function formatDirectoryDate(
  date: string | Date,
  locale: "en" | "ar",
): string {
  const d = typeof date === "string" ? new Date(date) : date;
  const safe = Number.isNaN(d.getTime()) ? new Date() : d;
  return new Intl.DateTimeFormat(locale === "ar" ? "ar-AE" : "en-AE", {
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(safe);
}
