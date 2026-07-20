/**
 * Production boot script, executed by the Docker CMD before the server
 * starts. Idempotent:
 *   1. Applies pending Drizzle migrations.
 *   2. Seeds the provider directory from the bundled official-list snapshot —
 *      ONLY when the providers table is completely empty (fresh database).
 *   3. Creates the first admin user from SEED_ADMIN_EMAIL/SEED_ADMIN_PASSWORD
 *      — ONLY when no users exist yet.
 * Uses the drizzle-orm/pg/bcryptjs packages already present in the standalone
 * bundle, so the runtime image needs no dev dependencies.
 */
import { readFileSync, existsSync } from "node:fs";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import bcrypt from "bcryptjs";
import pg from "pg";

const MIGRATIONS_DIR = process.env.MIGRATIONS_DIR ?? "./migrations";
const SEED_FILE = process.env.SEED_FILE ?? "./seed/providers.seed.json";

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  max: 2,
  ssl:
    process.env.DATABASE_SSL === "true" ? { rejectUnauthorized: false } : undefined,
});

/* Keep in sync with src/lib/normalize.ts */
const SUFFIX_TOKENS = new Set([
  "llc", "lc", "fz", "fzc", "fzco", "fze", "dmcc", "ltd", "limited",
  "inc", "incorporated", "co", "company", "corp", "corporation",
  "l", "c", "f", "z", "m", "e",
]);

function normalizeName(name) {
  const cleaned = name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9\s-]/g, " ")
    .replace(/[\s-]+/g, " ")
    .trim();
  const tokens = cleaned.split(" ");
  while (tokens.length > 1 && SUFFIX_TOKENS.has(tokens[tokens.length - 1])) {
    tokens.pop();
  }
  return tokens.join(" ");
}

function slugify(name) {
  return normalizeName(name).replace(/\s+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
}

async function seedProvidersIfEmpty() {
  const { rows } = await pool.query("select count(*)::int as count from providers");
  if (rows[0].count > 0) {
    console.log(`Providers table has ${rows[0].count} rows — seed skipped.`);
    return;
  }
  if (!existsSync(SEED_FILE)) {
    console.log("No seed file bundled — seed skipped.");
    return;
  }
  const data = JSON.parse(readFileSync(SEED_FILE, "utf8"));
  let inserted = 0;
  for (const p of data.providers) {
    await pool.query(
      `insert into providers
         (slug, name, normalized_name, website, description, description_ar,
          category, contacts, source)
       values ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, 'seed')
       on conflict (normalized_name) do nothing`,
      [
        slugify(p.name),
        p.name,
        normalizeName(p.name),
        p.website ?? null,
        p.description ?? null,
        p.descriptionAr ?? null,
        p.category ?? null,
        JSON.stringify(p.contacts ?? []),
      ],
    );
    inserted++;
  }
  console.log(`Seeded ${inserted} providers into empty database.`);
}

async function createAdminIfNone() {
  const email = (process.env.SEED_ADMIN_EMAIL ?? "").toLowerCase().trim();
  const password = process.env.SEED_ADMIN_PASSWORD ?? "";
  if (!email || password.length < 10) return;
  const { rows } = await pool.query("select count(*)::int as count from users");
  if (rows[0].count > 0) return;
  const hash = await bcrypt.hash(password, 12);
  await pool.query(
    `insert into users (email, password_hash, name, role)
     values ($1, $2, $3, 'admin') on conflict (email) do nothing`,
    [email, hash, "Admin"],
  );
  console.log(`Bootstrapped first admin user: ${email}`);
}

try {
  await migrate(drizzle(pool), { migrationsFolder: MIGRATIONS_DIR });
  console.log("Migrations applied.");
  await seedProvidersIfEmpty();
  await createAdminIfNone();
} catch (err) {
  console.error("Boot script failed:", err);
  process.exit(1);
} finally {
  await pool.end();
}
