import "dotenv/config";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { sql } from "drizzle-orm";
import { db } from "../db";
import { providers } from "../db/schema";
import { normalizeName, normalizeWebsite, slugify } from "../lib/normalize";

interface SeedProvider {
  name: string;
  website: string | null;
  description: string | null;
}

async function main() {
  const file = resolve(process.cwd(), "db-seed/providers.seed.json");
  const data = JSON.parse(readFileSync(file, "utf-8")) as {
    providers: SeedProvider[];
  };

  let inserted = 0;
  for (const p of data.providers) {
    const normalized = normalizeName(p.name);
    const result = await db
      .insert(providers)
      .values({
        name: p.name,
        normalizedName: normalized,
        slug: slugify(p.name),
        website: normalizeWebsite(p.website),
        description: p.description,
        source: "seed",
      })
      .onConflictDoNothing({ target: providers.normalizedName });
    if ((result.rowCount ?? 0) > 0) inserted++;
  }

  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(providers);
  console.log(`Seed complete: ${inserted} inserted, ${count} providers total.`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
