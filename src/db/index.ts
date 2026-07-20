import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

const globalForDb = globalThis as unknown as { pool?: Pool };

const pool =
  globalForDb.pool ??
  new Pool({
    connectionString: process.env.DATABASE_URL,
    // Prerendering runs in several parallel workers, each with its own pool —
    // keep build-time pools tiny so managed databases with low connection
    // limits aren't exhausted (which would silently trigger build fallbacks).
    max: process.env.NEXT_PHASE === "phase-production-build" ? 2 : 10,
    ssl:
      process.env.DATABASE_SSL === "true"
        ? { rejectUnauthorized: false }
        : undefined,
  });

if (process.env.NODE_ENV !== "production") globalForDb.pool = pool;

export const db = drizzle(pool, { schema });
export { schema };
