import { NextResponse, type NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { getConfig } from "@/lib/settings";
import {
  AGENT_SECRET_FIELDS,
  DEFAULT_AGENT_CONFIG,
  agentReadiness,
  getAgentConfig,
  setAgentConfig,
  type AgentConfig,
} from "@/lib/agents/config";
import { writeAudit } from "@/lib/audit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Programmatic agent configuration.
 *
 * The console form is the normal way to set these, but provisioning a new
 * environment (or re-running setup after a credential rotation) should not
 * require driving a browser. Same authorisation as the heartbeat: the
 * deployment secret or an admin session.
 *
 * Secrets can be written here but never read back — GET reports only whether
 * each one is set.
 */

async function isAuthorized(req: NextRequest): Promise<boolean> {
  const bearer = req.headers.get("authorization");
  const envSecret = process.env.INGEST_SECRET;
  if (envSecret && bearer === `Bearer ${envSecret}`) return true;
  const { ingestSecret } = await getConfig();
  if (ingestSecret && bearer === `Bearer ${ingestSecret}`) return true;
  const session = await auth();
  return session?.user?.role === "admin";
}

/** Coerce an incoming JSON value to the type the field expects. */
function coerce(key: keyof AgentConfig, value: unknown): string | number | boolean | null {
  const shape = DEFAULT_AGENT_CONFIG[key];
  if (typeof shape === "boolean") {
    if (typeof value === "boolean") return value;
    if (value === "true" || value === "1") return true;
    if (value === "false" || value === "0") return false;
    return null;
  }
  if (typeof shape === "number") {
    const n = typeof value === "number" ? value : Number(value);
    return Number.isFinite(n) ? n : null;
  }
  return typeof value === "string" ? value.trim() : null;
}

export async function POST(req: NextRequest) {
  if (!(await isAuthorized(req))) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const updates: Partial<AgentConfig> = {};
  const applied: string[] = [];
  const rejected: string[] = [];

  for (const [rawKey, rawValue] of Object.entries(body)) {
    if (!(rawKey in DEFAULT_AGENT_CONFIG)) {
      rejected.push(rawKey);
      continue;
    }
    const key = rawKey as keyof AgentConfig;
    const value = coerce(key, rawValue);
    if (value === null) {
      rejected.push(rawKey);
      continue;
    }
    (updates[key] as unknown) = value;
    applied.push(rawKey);
  }

  if (!applied.length) {
    return NextResponse.json({ ok: false, error: "no valid fields", rejected }, { status: 400 });
  }

  await setAgentConfig(updates);

  const session = await auth();
  await writeAudit({
    userId: session?.user?.id ?? null,
    action: "agents.config.update",
    entity: "agent_config",
    // Field names only — values, especially secrets, are never logged.
    diff: { fields: applied, via: "api" },
  });

  const config = await getAgentConfig();
  return NextResponse.json({ ok: true, applied, rejected, readiness: agentReadiness(config) });
}

/** Current configuration with every secret reduced to a boolean. */
export async function GET(req: NextRequest) {
  if (!(await isAuthorized(req))) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const config = await getAgentConfig();
  const safe: Record<string, unknown> = {};
  for (const key of Object.keys(DEFAULT_AGENT_CONFIG) as (keyof AgentConfig)[]) {
    safe[key] = AGENT_SECRET_FIELDS.includes(key) ? !!config[key] : config[key];
  }
  return NextResponse.json({ config: safe, readiness: agentReadiness(config) });
}
