import { beforeAll, beforeEach, describe, expect, it } from "vitest";

// Point the app's db client at the test database BEFORE importing any module
// that opens a pool. CI creates this database; locally:
//   createdb uaeasp_test (or via psql)
process.env.DATABASE_URL =
  process.env.DATABASE_URL_TEST ??
  "postgresql://postgres:devpass@127.0.0.1:5432/uaeasp_test";
process.env.DATABASE_SSL = "false";

const dbModule = await import("@/db");
const { db } = dbModule;
const { providers, scrapeRuns, scrapeChanges, appSettings } = await import("@/db/schema");
const { migrate } = await import("drizzle-orm/node-postgres/migrator");
const { reconcileProviders, recordFailedRun, MISSES_BEFORE_DELIST } = await import(
  "./reconcile"
);
const { normalizeName, slugify } = await import("@/lib/normalize");
const { eq } = await import("drizzle-orm");

function makeProviders(count: number, prefix = "Provider"): { name: string; website?: string }[] {
  return Array.from({ length: count }, (_, i) => ({
    name: `${prefix} ${i + 1} LLC`,
    website: `https://${prefix.toLowerCase()}${i + 1}.example.ae`,
  }));
}

async function ingest(list: { name: string; website?: string | null }[]) {
  return reconcileProviders({
    strategy: "scrape_html",
    triggeredBy: "test",
    providers: list,
  });
}

beforeAll(async () => {
  await migrate(db, { migrationsFolder: "src/db/migrations" });
});

beforeEach(async () => {
  await db.delete(scrapeChanges);
  await db.delete(scrapeRuns);
  await db.delete(providers);
  await db.delete(appSettings);
});

describe("reconcileProviders", () => {
  it("adds all providers on a fresh ingest", async () => {
    const result = await ingest(makeProviders(25));
    expect(result.status).toBe("success");
    expect(result.added).toBe(25);
    const rows = await db.select().from(providers);
    expect(rows).toHaveLength(25);
    expect(rows.every((r) => r.status === "active")).toBe(true);
  });

  it("rejects a payload below the absolute minimum count", async () => {
    await ingest(makeProviders(25));
    const result = await ingest(makeProviders(5));
    expect(result.status).toBe("rejected");
    expect(result.rejectedReason).toContain("Sanity gate");
    // Data untouched
    const rows = await db.select().from(providers);
    expect(rows.filter((r) => r.status === "active")).toHaveLength(25);
    expect(result.consecutiveFailures).toBe(1);
  });

  it("rejects a payload far smaller than the last good run", async () => {
    await ingest(makeProviders(40));
    const result = await ingest(makeProviders(21));
    expect(result.status).toBe("rejected");
    expect(result.rejectedReason).toContain("last good count");
  });

  it("rejects when more than half the active providers vanish at once", async () => {
    await ingest(makeProviders(30));
    // 24 unknown names + 6 known → 24 of 30 active missing (80%) but count gate passes
    const replacement = makeProviders(24, "Other").concat(makeProviders(6));
    const result = await ingest(replacement);
    expect(result.status).toBe("rejected");
    expect(result.rejectedReason).toContain("missing from payload");
  });

  it(`delists a provider only after ${MISSES_BEFORE_DELIST} consecutive missing runs, then restores it`, async () => {
    const full = makeProviders(25);
    await ingest(full);
    const withoutLast = full.slice(0, 24);

    const first = await ingest(withoutLast);
    expect(first.status).toBe("success");
    expect(first.missing).toBe(1);
    expect(first.delisted).toHaveLength(0);

    let [victim] = await db
      .select()
      .from(providers)
      .where(eq(providers.normalizedName, normalizeName("Provider 25 LLC")));
    expect(victim.status).toBe("active");
    expect(victim.missingScrapeCount).toBe(1);

    const second = await ingest(withoutLast);
    expect(second.delisted).toContain("Provider 25 LLC");
    [victim] = await db
      .select()
      .from(providers)
      .where(eq(providers.normalizedName, normalizeName("Provider 25 LLC")));
    expect(victim.status).toBe("delisted");

    // Provider reappears → restored, counter reset
    const third = await ingest(full);
    expect(third.restored).toContain("Provider 25 LLC");
    [victim] = await db
      .select()
      .from(providers)
      .where(eq(providers.normalizedName, normalizeName("Provider 25 LLC")));
    expect(victim.status).toBe("active");
    expect(victim.missingScrapeCount).toBe(0);
  });

  it("never overwrites admin-overridden fields", async () => {
    await ingest(makeProviders(25));
    const key = normalizeName("Provider 1 LLC");
    await db
      .update(providers)
      .set({
        website: "https://manually-corrected.ae",
        adminOverrides: { website: true },
      })
      .where(eq(providers.normalizedName, key));

    const changed = makeProviders(25).map((p, i) =>
      i === 0 ? { ...p, website: "https://scraped-wrong.example.ae" } : p,
    );
    const result = await ingest(changed);
    expect(result.status).toBe("success");

    const [row] = await db.select().from(providers).where(eq(providers.normalizedName, key));
    expect(row.website).toBe("https://manually-corrected.ae");
    expect(row.missingScrapeCount).toBe(0);
    expect(row.lastSeenInScrapeAt).not.toBeNull();
  });

  it("keeps slugs stable across name tweaks and matches legal-suffix variants", async () => {
    await ingest([
      ...makeProviders(24),
      { name: "Comarch Middle East FZ LLC", website: "https://comarch.ae" },
    ]);
    const [before] = await db
      .select()
      .from(providers)
      .where(eq(providers.slug, "comarch-middle-east"));
    expect(before).toBeDefined();

    // Same provider, different legal suffix formatting → must match, not duplicate
    const result = await ingest([
      ...makeProviders(24),
      { name: "Comarch Middle East L.L.C", website: "https://comarch.ae" },
    ]);
    expect(result.added).toBe(0);
    const [after] = await db
      .select()
      .from(providers)
      .where(eq(providers.slug, "comarch-middle-east"));
    expect(after).toBeDefined();
    expect(after.id).toBe(before.id);
  });

  it("matches by website domain when the name changes entirely", async () => {
    await ingest([
      ...makeProviders(24),
      { name: "Old Brand Name LLC", website: "https://samecompany.ae" },
    ]);
    const result = await ingest([
      ...makeProviders(24),
      { name: "Completely New Brand FZCO", website: "https://samecompany.ae" },
    ]);
    expect(result.added).toBe(0);
    expect(result.missing).toBe(0);
    const rows = await db.select().from(providers);
    expect(rows).toHaveLength(25);
    const renamed = rows.find((r) => r.name === "Completely New Brand FZCO");
    expect(renamed).toBeDefined();
    // Slug stays the original — public URL never breaks
    expect(renamed!.slug).toBe(slugify("Old Brand Name LLC"));
  });

  it("records failed runs and counts consecutive failures", async () => {
    const first = await recordFailedRun({ error: "boom", triggeredBy: "test" });
    expect(first.consecutiveFailures).toBe(1);
    const second = await recordFailedRun({ error: "boom again", triggeredBy: "test" });
    expect(second.consecutiveFailures).toBe(2);

    // A good run resets the streak
    const ok = await ingest(makeProviders(25));
    expect(ok.consecutiveFailures).toBe(0);
  });

  it("deduplicates repeated names inside one payload", async () => {
    const duped = [...makeProviders(25), ...makeProviders(3)];
    const result = await ingest(duped);
    expect(result.found).toBe(25);
    expect(result.added).toBe(25);
  });
});
