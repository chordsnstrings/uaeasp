import { eq } from "drizzle-orm";
import { db } from "@/db";
import { appSettings } from "@/db/schema";
import { getAgentConfig } from "./config";
import {
  claimSlot,
  lastSuccessfulScrape,
  runDueMaintenance,
  type MaintenanceOutcome,
} from "./maintenance";
import { queueDepth, reclaimStale } from "./queue";
import { drainQueue } from "./runner";
import { scheduleDueWork } from "./scheduler";

/**
 * One beat of the system's clock, shared by every caller: the in-process timer
 * (see src/instrumentation.ts), the authenticated /api/agents/tick endpoint,
 * and the admin console button.
 *
 * A slot claim in the database keeps concurrent callers from doubling up, so
 * running the internal timer and an external cron at the same time is safe.
 */

export interface HeartbeatResult {
  skipped?: string;
  reclaimed?: number;
  maintenance?: MaintenanceOutcome;
  scheduled?: string[];
  processed?: number;
  depth?: Record<string, number>;
  ms?: number;
}

/**
 * Operational health: when the clock last beat, and when the directory was
 * last refreshed. Exposed unauthenticated (times only, no data) so the
 * scheduler can be confirmed alive without logging on every quiet beat.
 */
export async function heartbeatState(): Promise<{
  lastBeatAt: string | null;
  lastRefreshAt: string | null;
}> {
  const [beat, refresh] = await Promise.all([
    db
      .select({ at: appSettings.updatedAt })
      .from(appSettings)
      .where(eq(appSettings.key, "heartbeat_claim"))
      .limit(1),
    lastSuccessfulScrape(),
  ]);
  return {
    lastBeatAt: beat[0]?.at ? new Date(beat[0].at).toISOString() : null,
    lastRefreshAt: refresh ? refresh.toISOString() : null,
  };
}

export async function heartbeat(
  options: { limit?: number; minGapSeconds?: number } = {},
): Promise<HeartbeatResult> {
  const started = Date.now();
  const minGap = options.minGapSeconds ?? 45;

  if (minGap > 0 && !(await claimSlot("heartbeat_claim", minGap))) {
    return { skipped: "another beat ran moments ago" };
  }

  // Directory upkeep runs regardless of whether the agents are switched on.
  const maintenance = await runDueMaintenance();

  const config = await getAgentConfig();
  if (!config.agentsEnabled) {
    return {
      skipped: "agents disabled",
      maintenance,
      ms: Date.now() - started,
    };
  }

  const reclaimed = await reclaimStale();
  const scheduled = await scheduleDueWork();
  const processed = await drainQueue(options.limit ?? 10);
  const depth = await queueDepth();

  return { reclaimed, maintenance, scheduled, processed, depth, ms: Date.now() - started };
}
