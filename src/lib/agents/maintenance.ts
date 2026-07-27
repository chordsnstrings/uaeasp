import { desc, sql } from "drizzle-orm";
import { db } from "@/db";
import { appSettings, scrapeRuns } from "@/db/schema";
import { fetchMofProviders } from "@/lib/ingest/fetch-mof";
import { processIngestPayload } from "@/lib/ingest/process";
import { recordFailedRun } from "@/lib/ingest/reconcile";
import { dubaiDayStart } from "./mailer";

/**
 * Scheduled upkeep that must happen whether or not the growth agents are
 * switched on — currently just the nightly provider-directory refresh.
 *
 * The GitHub Actions workflow is the belt; this is the braces. It runs from
 * the app's own heartbeat, so the directory stays current even when the
 * repository's default branch (which is what activates workflow crons) has
 * not been switched.
 */

/** Nightly window in Dubai time. Before this hour, the day's run can wait. */
const REFRESH_HOUR_DUBAI = 2;
/** If no successful run in this long, refresh regardless of the hour. */
const STALE_AFTER_HOURS = 26;

const DUBAI_OFFSET_MS = 4 * 60 * 60 * 1000;

export function dubaiHour(at: Date = new Date()): number {
  return new Date(at.getTime() + DUBAI_OFFSET_MS).getUTCHours();
}

export interface MaintenanceOutcome {
  ran: boolean;
  reason: string;
  detail?: string;
}

/**
 * Claim a slot so two callers (the internal timer and an external cron hitting
 * the endpoint) cannot both start a refresh. The conditional upsert is atomic:
 * only one transaction can satisfy the age predicate.
 */
async function claimSlot(key: string, minGapSeconds: number): Promise<boolean> {
  const { rows } = await db.execute<{ key: string }>(sql`
    INSERT INTO app_settings (key, value, updated_at)
    VALUES (${key}, jsonb_build_object('at', now()), now())
    ON CONFLICT (key) DO UPDATE
      SET value = jsonb_build_object('at', now()), updated_at = now()
      WHERE app_settings.updated_at < now() - (interval '1 second' * ${minGapSeconds})
    RETURNING key
  `);
  return rows.length > 0;
}

export async function lastSuccessfulScrape(): Promise<Date | null> {
  const [row] = await db
    .select({ finishedAt: scrapeRuns.finishedAt, startedAt: scrapeRuns.startedAt })
    .from(scrapeRuns)
    .where(sql`status IN ('success','partial')`)
    .orderBy(desc(scrapeRuns.startedAt))
    .limit(1);
  if (!row) return null;
  return new Date(row.finishedAt ?? row.startedAt);
}

/** Decide whether the directory refresh is due right now. */
export function refreshIsDue(lastRun: Date | null, now = new Date()): boolean {
  if (!lastRun) return true;
  const ageMs = now.getTime() - lastRun.getTime();
  if (ageMs > STALE_AFTER_HOURS * 3_600_000) return true;
  // Otherwise: once per Dubai day, no earlier than the nightly window.
  const ranToday = lastRun.getTime() >= dubaiDayStart(now).getTime();
  return !ranToday && dubaiHour(now) >= REFRESH_HOUR_DUBAI;
}

/** Run the nightly directory refresh if it is due. Safe to call every tick. */
export async function runDueMaintenance(): Promise<MaintenanceOutcome> {
  const lastRun = await lastSuccessfulScrape();
  if (!refreshIsDue(lastRun)) {
    return { ran: false, reason: "not due" };
  }
  // 30-minute gap stops a failing fetch from being retried every few minutes.
  if (!(await claimSlot("maintenance_refresh_claim", 30 * 60))) {
    return { ran: false, reason: "another worker claimed it" };
  }

  const fetched = await fetchMofProviders();
  if (!fetched.ok) {
    await recordFailedRun({
      error: fetched.error ?? "Unknown fetch error",
      strategy: "scrape_html",
      triggeredBy: "auto",
    });
    return { ran: true, reason: "fetch failed", detail: fetched.error };
  }

  const result = await processIngestPayload({
    strategy: "scrape_html",
    triggeredBy: "auto",
    providers: fetched.providers,
  });

  return {
    ran: true,
    reason: result.status,
    detail:
      result.status === "rejected"
        ? (result.rejectedReason ?? "rejected by safety checks")
        : `${result.found} found · +${result.added} added · ${result.updated} updated · ${result.missing} missing`,
  };
}

export { claimSlot };
