import type { AgentTask } from "@/db/schema";

/** What a handler reports back so the run log stays meaningful. */
export interface AgentResult {
  itemsIn: number;
  itemsOut: number;
  summary?: Record<string, unknown>;
}

export interface AgentContext {
  /** Appends to the run's log line — visible in /admin/agents. */
  log: (message: string) => void;
  /** Accumulates AI usage so a run's true cost is recorded. */
  addTokens: (tokens: number) => void;
}

export type AgentHandler = (task: AgentTask, ctx: AgentContext) => Promise<AgentResult>;
