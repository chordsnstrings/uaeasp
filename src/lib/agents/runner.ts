import { eq } from "drizzle-orm";
import { db } from "@/db";
import { agentRuns, type AgentKey, type AgentTask } from "@/db/schema";
import { analystHandlers } from "./analyst";
import { getAgentConfig, agentReadiness } from "./config";
import { conversationalistHandlers } from "./conversationalist";
import { prospectorHandlers } from "./prospector";
import { claimNext, completeTask, failTask } from "./queue";
import type { AgentContext, AgentHandler, AgentResult } from "./types";
import { visibilityHandlers } from "./visibility";

/**
 * Dispatch table + execution wrapper.
 *
 * Every task runs inside a recorded agent_run, so the console can always answer
 * "what did the agents do, what did it cost, and what broke". A disabled or
 * unconfigured agent's tasks are parked rather than failed — flipping the
 * switch back on resumes exactly where it stopped.
 */

export const HANDLERS: Record<AgentKey, Record<string, AgentHandler>> = {
  visibility: visibilityHandlers,
  prospector: prospectorHandlers,
  conversationalist: conversationalistHandlers,
  analyst: analystHandlers,
};

export class AgentDisabledError extends Error {
  constructor(agent: string, reason: string) {
    super(`${agent} is not runnable: ${reason}`);
    this.name = "AgentDisabledError";
  }
}

export async function runTask(task: AgentTask): Promise<AgentResult> {
  const config = await getAgentConfig();
  const readiness = agentReadiness(config)[task.agent];
  if (!readiness.enabled) throw new AgentDisabledError(task.agent, "disabled");
  if (!readiness.ready) {
    throw new AgentDisabledError(task.agent, `missing ${readiness.missing.join(", ")}`);
  }

  const handler = HANDLERS[task.agent]?.[task.kind];
  if (!handler) throw new Error(`No handler for ${task.agent}/${task.kind}`);

  const logs: string[] = [];
  const models = new Set<string>();
  let tokens = 0;
  const ctx: AgentContext = {
    log: (message) => {
      logs.push(message);
      console.log(`[agent:${task.agent}/${task.kind}] ${message}`);
    },
    addTokens: (n, model) => {
      tokens += n;
      if (model) models.add(model);
    },
  };

  const [run] = await db
    .insert(agentRuns)
    .values({ agent: task.agent, kind: task.kind, taskId: task.id })
    .returning({ id: agentRuns.id });

  try {
    const result = await handler(task, ctx);
    await db
      .update(agentRuns)
      .set({
        status: "success",
        itemsIn: result.itemsIn,
        itemsOut: result.itemsOut,
        aiTokens: tokens,
        summary: { ...(result.summary ?? {}), logs, models: [...models] },
        finishedAt: new Date(),
      })
      .where(eq(agentRuns.id, run.id));
    return result;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await db
      .update(agentRuns)
      .set({
        status: "failed",
        aiTokens: tokens,
        error: message.slice(0, 2000),
        summary: { logs, models: [...models] },
        finishedAt: new Date(),
      })
      .where(eq(agentRuns.id, run.id));
    throw err;
  }
}

/**
 * Drain up to `limit` tasks. Returns how many ran. A task belonging to a
 * paused agent is pushed 15 minutes into the future without consuming an
 * attempt, so pausing an agent never burns its retry budget.
 */
export async function drainQueue(limit = 10, agents?: AgentKey[]): Promise<number> {
  const config = await getAgentConfig();
  if (!config.agentsEnabled) return 0;

  let processed = 0;
  for (let i = 0; i < limit; i += 1) {
    const task = await claimNext(agents);
    if (!task) break;
    try {
      await runTask(task);
      await completeTask(task.id);
      processed += 1;
    } catch (err) {
      if (err instanceof AgentDisabledError) {
        await db
          .update(agentRuns)
          .set({ status: "failed" })
          .where(eq(agentRuns.taskId, task.id));
        // Park, don't fail: give the operator time to finish configuring.
        await failTask({ ...task, attempts: task.attempts - 1 }, err);
      } else {
        await failTask(task, err);
      }
    }
  }
  return processed;
}
