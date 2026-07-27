import { getAgentConfig } from "./config";
import { dubaiDayStart } from "./mailer";
import { enqueue } from "./queue";

/**
 * Periodic work, expressed as idempotent enqueues.
 *
 * Every tick asks "is today's/this week's job already queued?" and the dedupe
 * key answers. That means the tick can fire as often as it likes — from cron,
 * from the admin console, twice at once — and each scheduled job still happens
 * exactly once.
 */

function dayKey(date = new Date()): string {
  return dubaiDayStart(date).toISOString().slice(0, 10);
}

function isoWeekKey(date = new Date()): string {
  const d = new Date(dubaiDayStart(date));
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((d.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

export async function scheduleDueWork(): Promise<string[]> {
  const config = await getAgentConfig();
  if (!config.agentsEnabled) return [];
  const queued: string[] = [];
  const day = dayKey();
  const week = isoWeekKey();

  const add = async (
    label: string,
    input: Parameters<typeof enqueue>[0],
  ): Promise<void> => {
    const id = await enqueue(input);
    if (id) queued.push(label);
  };

  if (config.prospectorEnabled) {
    await add("prospector/daily_plan", {
      agent: "prospector",
      kind: "daily_plan",
      dedupeKey: `prospector-daily:${day}`,
    });
  }

  if (config.conversationalistEnabled) {
    // Follow-ups and approved-message flushes run several times a day so the
    // send rate stays smooth rather than arriving in one burst.
    await add("conversationalist/tick", {
      agent: "conversationalist",
      kind: "tick",
      dedupeKey: `conv-tick:${day}:${Math.floor(new Date().getUTCHours() / 4)}`,
    });
    await add("conversationalist/flush_approved", {
      agent: "conversationalist",
      kind: "flush_approved",
      dedupeKey: `conv-flush:${day}:${new Date().getUTCHours()}`,
      priority: 30,
    });
  }

  if (config.visibilityEnabled) {
    await add("visibility/weekly", {
      agent: "visibility",
      kind: "weekly",
      dedupeKey: `visibility-weekly:${week}`,
    });
  }

  if (config.analystEnabled) {
    await add("analyst/weekly_report", {
      agent: "analyst",
      kind: "weekly_report",
      dedupeKey: `analyst-weekly:${week}`,
    });
  }

  return queued;
}
