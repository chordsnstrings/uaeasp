import { and, eq, lte, sql } from "drizzle-orm";
import { db } from "@/db";
import { AGENT_KEYS, agentTasks, type AgentKey, type AgentTask } from "@/db/schema";

/**
 * Postgres-backed job queue for the growth agents.
 *
 * One table, claimed with FOR UPDATE SKIP LOCKED so any number of workers can
 * drain it concurrently without a broker. Retries use exponential backoff via
 * run_after; dedupeKey makes enqueueing idempotent (re-running a scheduler
 * tick never duplicates work).
 */

export interface EnqueueInput {
  agent: AgentKey;
  kind: string;
  payload?: Record<string, unknown>;
  /** Idempotency key. A second enqueue with the same key is ignored. */
  dedupeKey?: string;
  runAfter?: Date;
  priority?: number;
  maxAttempts?: number;
}

export async function enqueue(input: EnqueueInput): Promise<string | null> {
  const rows = await db
    .insert(agentTasks)
    .values({
      agent: input.agent,
      kind: input.kind,
      payload: input.payload ?? {},
      dedupeKey: input.dedupeKey ?? null,
      runAfter: input.runAfter ?? new Date(),
      priority: input.priority ?? 100,
      maxAttempts: input.maxAttempts ?? 3,
    })
    .onConflictDoNothing({ target: agentTasks.dedupeKey })
    .returning({ id: agentTasks.id });
  return rows[0]?.id ?? null;
}

/** Claim the next runnable task atomically. Returns null when the queue is dry. */
export async function claimNext(agents?: AgentKey[]): Promise<AgentTask | null> {
  // Whitelisted against the known agent keys before it can reach the query —
  // the raw fragment is only ever built from that fixed set.
  const allowed = (agents ?? []).filter((a) => AGENT_KEYS.includes(a));
  const agentFilter = allowed.length
    ? sql`AND agent = ANY(${sql.raw(`ARRAY[${allowed.map((a) => `'${a}'`).join(",")}]::text[]`)})`
    : sql``;
  const { rows } = await db.execute<AgentTask>(sql`
    UPDATE agent_tasks SET
      status = 'running',
      attempts = attempts + 1,
      started_at = now()
    WHERE id = (
      SELECT id FROM agent_tasks
      WHERE status = 'queued' AND run_after <= now() ${agentFilter}
      ORDER BY priority ASC, run_after ASC
      FOR UPDATE SKIP LOCKED
      LIMIT 1
    )
    RETURNING *
  `);
  return rows[0] ?? null;
}

export async function completeTask(id: string): Promise<void> {
  await db
    .update(agentTasks)
    .set({ status: "done", finishedAt: new Date(), error: null })
    .where(eq(agentTasks.id, id));
}

/** Fail a task: reschedule with backoff, or bury it once attempts run out. */
export async function failTask(task: AgentTask, error: unknown): Promise<void> {
  const message = error instanceof Error ? error.message : String(error);
  const exhausted = task.attempts >= task.maxAttempts;
  if (exhausted) {
    await db
      .update(agentTasks)
      .set({ status: "failed", finishedAt: new Date(), error: message.slice(0, 2000) })
      .where(eq(agentTasks.id, task.id));
    return;
  }
  // 1min, 5min, 25min …
  const delayMs = Math.min(60_000 * 5 ** (task.attempts - 1), 6 * 60 * 60 * 1000);
  await db
    .update(agentTasks)
    .set({
      status: "queued",
      runAfter: new Date(Date.now() + delayMs),
      error: message.slice(0, 2000),
    })
    .where(eq(agentTasks.id, task.id));
}

/** Re-queue tasks a crashed worker left claimed. Safe to call on boot. */
export async function reclaimStale(olderThanMinutes = 30): Promise<number> {
  const cutoff = new Date(Date.now() - olderThanMinutes * 60_000);
  // Bury anything that has already used its attempts — otherwise a task that
  // crashes the worker every time is resurrected forever.
  await db
    .update(agentTasks)
    .set({ status: "failed", finishedAt: new Date(), error: "abandoned after repeated crashes" })
    .where(
      and(
        eq(agentTasks.status, "running"),
        lte(agentTasks.startedAt, cutoff),
        sql`${agentTasks.attempts} >= ${agentTasks.maxAttempts}`,
      ),
    );
  const rows = await db
    .update(agentTasks)
    .set({ status: "queued", runAfter: new Date() })
    .where(
      and(
        eq(agentTasks.status, "running"),
        lte(agentTasks.startedAt, cutoff),
        sql`${agentTasks.attempts} < ${agentTasks.maxAttempts}`,
      ),
    )
    .returning({ id: agentTasks.id });
  return rows.length;
}

export async function queueDepth(): Promise<Record<string, number>> {
  const { rows } = await db.execute<{ status: string; count: string }>(sql`
    SELECT status, count(*)::text AS count FROM agent_tasks GROUP BY status
  `);
  return Object.fromEntries(rows.map((r) => [r.status, Number(r.count)]));
}
