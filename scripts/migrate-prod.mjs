/**
 * Production migration runner. Executed by the Docker CMD before the server
 * starts (idempotent — Drizzle's journal skips applied migrations). Uses the
 * drizzle-orm + pg packages already present in the standalone bundle, so the
 * runtime image needs no dev dependencies.
 */
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import pg from "pg";

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  max: 2,
  ssl:
    process.env.DATABASE_SSL === "true" ? { rejectUnauthorized: false } : undefined,
});

try {
  await migrate(drizzle(pool), { migrationsFolder: "./migrations" });
  console.log("Migrations applied.");
} catch (err) {
  console.error("Migration failed:", err);
  process.exit(1);
} finally {
  await pool.end();
}
