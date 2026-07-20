import "dotenv/config";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { and, eq, notInArray, sql } from "drizzle-orm";
import { db } from "../db";
import { providers, type ProviderCategory, type ProviderContact } from "../db/schema";
import { normalizeName, normalizeWebsite, slugify } from "../lib/normalize";

interface SeedProvider {
  name: string;
  website: string | null;
  category?: ProviderCategory | null;
  contacts?: ProviderContact[];
  description: string | null;
  descriptionAr?: string | null;
}

async function main() {
  const file = resolve(process.cwd(), "db-seed/providers.seed.json");
  const data = JSON.parse(readFileSync(file, "utf-8")) as {
    providers: SeedProvider[];
  };

  let inserted = 0;
  let updated = 0;
  const seedKeys: string[] = [];

  for (const p of data.providers) {
    const normalized = normalizeName(p.name);
    seedKeys.push(normalized);
    const values = {
      name: p.name,
      normalizedName: normalized,
      slug: slugify(p.name),
      website: normalizeWebsite(p.website),
      description: p.description,
      descriptionAr: p.descriptionAr ?? null,
      category: p.category ?? null,
      contacts: p.contacts ?? [],
      source: "seed" as const,
    };
    const result = await db
      .insert(providers)
      .values(values)
      .onConflictDoUpdate({
        target: providers.normalizedName,
        set: {
          // Slug is intentionally NOT updated — public URLs stay stable.
          name: values.name,
          website: values.website,
          description: values.description,
          descriptionAr: values.descriptionAr,
          category: values.category,
          contacts: values.contacts,
          updatedAt: new Date(),
        },
      })
      .returning({ createdAt: providers.createdAt, updatedAt: providers.updatedAt });
    if (result[0] && result[0].createdAt.getTime() === result[0].updatedAt.getTime()) {
      inserted++;
    } else {
      updated++;
    }
  }

  // Remove stale seed-only rows that are no longer on the official list.
  // Scraped or manually-added rows are never touched here.
  const removed = await db
    .delete(providers)
    .where(
      and(
        eq(providers.source, "seed"),
        notInArray(providers.normalizedName, seedKeys),
      ),
    )
    .returning({ name: providers.name });
  for (const row of removed) {
    console.log(`removed stale seed entry: ${row.name}`);
  }

  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(providers);
  console.log(
    `Seed complete: ${inserted} inserted, ${updated} updated, ${removed.length} removed, ${count} providers total.`,
  );
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
