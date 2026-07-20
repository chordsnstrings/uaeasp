import { eq, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  appSettings,
  providers,
  scrapeChanges,
  scrapeRuns,
  type Provider,
} from "@/db/schema";
import { normalizeName, normalizeWebsite, slugify, websiteDomain } from "@/lib/normalize";
import type { IngestPayload } from "@/lib/validation/provider-ingest";

/**
 * Reconciles a scraped provider list against the database.
 *
 * Fail-safe principles:
 *  - NEVER delete rows. Providers missing from a run are counted, and only
 *    delisted (still visible, marked "no longer listed") after
 *    MISSES_BEFORE_DELIST consecutive missing runs.
 *  - Suspicious payloads (too few providers, too many missing at once) are
 *    REJECTED outright: the run is recorded with its raw payload for
 *    forensics and the live directory stays on last-known-good data.
 *  - Fields an admin has manually edited (provider.adminOverrides) are never
 *    overwritten by a scrape.
 */

export const MIN_ABSOLUTE_COUNT = 20;
export const MIN_RATIO_OF_LAST_GOOD = 0.6;
export const MAX_MISSING_RATIO = 0.5;
export const MISSES_BEFORE_DELIST = 2;

export interface ReconcileResult {
  runId: string;
  status: "success" | "rejected";
  rejectedReason?: string;
  found: number;
  added: number;
  updated: number;
  missing: number;
  delisted: string[];
  restored: string[];
  addedNames: string[];
  consecutiveFailures: number;
}

async function getSetting<T>(key: string): Promise<T | null> {
  const [row] = await db.select().from(appSettings).where(eq(appSettings.key, key)).limit(1);
  return row ? (row.value as T) : null;
}

async function setSetting(key: string, value: unknown): Promise<void> {
  await db
    .insert(appSettings)
    .values({ key, value, updatedAt: new Date() })
    .onConflictDoUpdate({ target: appSettings.key, set: { value, updatedAt: new Date() } });
}

async function bumpConsecutiveFailures(): Promise<number> {
  const current = (await getSetting<{ count: number }>("consecutive_failures"))?.count ?? 0;
  const next = current + 1;
  await setSetting("consecutive_failures", { count: next });
  return next;
}

export async function recordFailedRun({
  error,
  strategy,
  triggeredBy,
}: {
  error: string;
  strategy?: "scrape_html" | "scrape_pdf" | "manual";
  triggeredBy: string;
}): Promise<{ runId: string; consecutiveFailures: number }> {
  const [run] = await db
    .insert(scrapeRuns)
    .values({
      status: "failed",
      strategy: strategy ?? null,
      error: error.slice(0, 5000),
      triggeredBy,
      finishedAt: new Date(),
    })
    .returning({ id: scrapeRuns.id });
  const consecutiveFailures = await bumpConsecutiveFailures();
  return { runId: run.id, consecutiveFailures };
}

export async function reconcileProviders(payload: IngestPayload): Promise<ReconcileResult> {
  const now = new Date();

  // Normalize + dedupe incoming rows (a scrape can double-list a provider).
  const incomingMap = new Map<
    string,
    {
      name: string;
      website: string | null;
      contacts: { name?: string; emails: string[]; phones: string[] }[] | null;
    }
  >();
  for (const p of payload.providers) {
    const key = normalizeName(p.name);
    if (!key) continue;
    if (!incomingMap.has(key)) {
      incomingMap.set(key, {
        name: p.name.trim(),
        website: normalizeWebsite(p.website),
        contacts: p.contacts && p.contacts.length > 0 ? p.contacts : null,
      });
    }
  }
  const found = incomingMap.size;

  const [run] = await db
    .insert(scrapeRuns)
    .values({
      status: "rejected", // pessimistic default; flipped to success at the end
      strategy: payload.strategy,
      providersFound: found,
      rawPayload: payload as unknown as Record<string, unknown>,
      triggeredBy: payload.triggeredBy,
    })
    .returning({ id: scrapeRuns.id });
  const runId = run.id;

  const existing = await db.select().from(providers);
  const existingActive = existing.filter((p) => p.status === "active");

  const reject = async (reason: string): Promise<ReconcileResult> => {
    await db
      .update(scrapeRuns)
      .set({ status: "rejected", error: reason, finishedAt: new Date() })
      .where(eq(scrapeRuns.id, runId));
    const consecutiveFailures = await bumpConsecutiveFailures();
    return {
      runId,
      status: "rejected",
      rejectedReason: reason,
      found,
      added: 0,
      updated: 0,
      missing: 0,
      delisted: [],
      restored: [],
      addedNames: [],
      consecutiveFailures,
    };
  };

  /* ---------- sanity gates ---------- */

  if (found < MIN_ABSOLUTE_COUNT) {
    return reject(
      `Sanity gate: only ${found} providers in payload (minimum ${MIN_ABSOLUTE_COUNT}). Keeping last-known-good data.`,
    );
  }

  const lastGoodCount =
    (await getSetting<{ count: number }>("last_good_count"))?.count ?? null;
  if (lastGoodCount && found < lastGoodCount * MIN_RATIO_OF_LAST_GOOD) {
    return reject(
      `Sanity gate: payload has ${found} providers, less than ${Math.round(
        MIN_RATIO_OF_LAST_GOOD * 100,
      )}% of last good count (${lastGoodCount}). Keeping last-known-good data.`,
    );
  }

  // Match existing rows against incoming (by normalized name, then by domain).
  const incomingByDomain = new Map<string, string>();
  for (const [key, value] of incomingMap) {
    const domain = websiteDomain(value.website);
    if (domain) incomingByDomain.set(domain, key);
  }

  const matchIncomingKey = (p: Provider): string | null => {
    if (incomingMap.has(p.normalizedName)) return p.normalizedName;
    const domain = websiteDomain(p.website);
    if (domain) {
      const byDomain = incomingByDomain.get(domain);
      if (byDomain) return byDomain;
    }
    return null;
  };

  const missingActive = existingActive.filter((p) => matchIncomingKey(p) === null);
  if (
    existingActive.length >= MIN_ABSOLUTE_COUNT &&
    missingActive.length / existingActive.length > MAX_MISSING_RATIO
  ) {
    return reject(
      `Sanity gate: ${missingActive.length} of ${existingActive.length} active providers missing from payload (> ${Math.round(
        MAX_MISSING_RATIO * 100,
      )}%). Keeping last-known-good data.`,
    );
  }

  /* ---------- apply ---------- */

  let added = 0;
  let updated = 0;
  const addedNames: string[] = [];
  const delistedNames: string[] = [];
  const restoredNames: string[] = [];
  const matchedKeys = new Set<string>();

  const existingSlugs = new Set(existing.map((p) => p.slug));
  const changeRows: (typeof scrapeChanges.$inferInsert)[] = [];

  // Pass 1: update matched, track which incoming entries were consumed.
  for (const p of existing) {
    const key = matchIncomingKey(p);
    if (!key) continue;
    const incoming = incomingMap.get(key)!;
    matchedKeys.add(key);

    const overrides = (p.adminOverrides ?? {}) as Record<string, boolean>;
    const set: Partial<typeof providers.$inferInsert> = {
      lastSeenInScrapeAt: now,
      missingScrapeCount: 0,
      source: payload.strategy,
    };
    let fieldChanged = false;

    if (incoming.name !== p.name && !overrides.name) {
      changeRows.push({
        runId,
        providerId: p.id,
        changeType: "updated",
        field: "name",
        oldValue: p.name,
        newValue: incoming.name,
      });
      set.name = incoming.name;
      fieldChanged = true;
    }
    if (incoming.website && incoming.website !== p.website && !overrides.website) {
      changeRows.push({
        runId,
        providerId: p.id,
        changeType: "updated",
        field: "website",
        oldValue: p.website,
        newValue: incoming.website,
      });
      set.website = incoming.website;
      fieldChanged = true;
    }
    if (
      incoming.contacts &&
      !overrides.contacts &&
      JSON.stringify(incoming.contacts) !== JSON.stringify(p.contacts ?? [])
    ) {
      changeRows.push({
        runId,
        providerId: p.id,
        changeType: "updated",
        field: "contacts",
        oldValue: JSON.stringify(p.contacts ?? []).slice(0, 1000),
        newValue: JSON.stringify(incoming.contacts).slice(0, 1000),
      });
      set.contacts = incoming.contacts;
      fieldChanged = true;
    }

    if (p.status === "delisted") {
      set.status = "active";
      restoredNames.push(incoming.name);
      changeRows.push({
        runId,
        providerId: p.id,
        changeType: "restored",
        field: "status",
        oldValue: "delisted",
        newValue: "active",
      });
      fieldChanged = true;
    }

    if (fieldChanged) {
      set.updatedAt = now;
      updated++;
    }
    await db.update(providers).set(set).where(eq(providers.id, p.id));
  }

  // Pass 2: insert brand-new providers.
  for (const [key, incoming] of incomingMap) {
    if (matchedKeys.has(key)) continue;
    let slug = slugify(incoming.name) || `provider-${added + 1}`;
    let candidate = slug;
    let suffix = 2;
    while (existingSlugs.has(candidate)) {
      candidate = `${slug}-${suffix++}`;
    }
    slug = candidate;
    existingSlugs.add(slug);

    const [inserted] = await db
      .insert(providers)
      .values({
        name: incoming.name,
        normalizedName: key,
        slug,
        website: incoming.website,
        contacts: incoming.contacts ?? [],
        source: payload.strategy,
        firstSeenAt: now,
        lastSeenInScrapeAt: now,
      })
      .onConflictDoNothing({ target: providers.normalizedName })
      .returning({ id: providers.id });
    if (inserted) {
      added++;
      addedNames.push(incoming.name);
      changeRows.push({
        runId,
        providerId: inserted.id,
        changeType: "added",
        field: null,
        oldValue: null,
        newValue: incoming.name,
      });
    }
  }

  // Pass 3: handle missing (never delete; delist after grace period).
  // Hidden providers are admin-managed and left alone.
  let missing = 0;
  for (const p of existing) {
    if (p.status === "hidden") continue;
    if (matchIncomingKey(p) !== null) continue;
    missing++;
    const nextCount = p.missingScrapeCount + 1;
    const shouldDelist = p.status === "active" && nextCount >= MISSES_BEFORE_DELIST;
    await db
      .update(providers)
      .set({
        missingScrapeCount: nextCount,
        ...(shouldDelist ? { status: "delisted" as const, updatedAt: now } : {}),
      })
      .where(eq(providers.id, p.id));
    changeRows.push({
      runId,
      providerId: p.id,
      changeType: shouldDelist ? "delisted" : "missing",
      field: shouldDelist ? "status" : null,
      oldValue: shouldDelist ? "active" : null,
      newValue: shouldDelist ? "delisted" : `missing ${nextCount}x`,
    });
    if (shouldDelist) delistedNames.push(p.name);
  }

  if (changeRows.length > 0) {
    await db.insert(scrapeChanges).values(changeRows);
  }

  await db
    .update(scrapeRuns)
    .set({
      status: "success",
      added,
      updated,
      missing,
      finishedAt: new Date(),
    })
    .where(eq(scrapeRuns.id, runId));

  await setSetting("last_good_run_id", { runId });
  await setSetting("consecutive_failures", { count: 0 });
  const [activeCount] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(providers)
    .where(eq(providers.status, "active"));
  await setSetting("last_good_count", { count: activeCount?.count ?? found });

  return {
    runId,
    status: "success",
    found,
    added,
    updated,
    missing,
    delisted: delistedNames,
    restored: restoredNames,
    addedNames,
    consecutiveFailures: 0,
  };
}
