import { NextResponse, type NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { getConfig } from "@/lib/settings";
import { AGENT_KEYS, type AgentKey } from "@/db/schema";
import { enqueue } from "@/lib/agents/queue";
import { heartbeat } from "@/lib/agents/heartbeat";
import { HANDLERS } from "@/lib/agents/runner";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Run one named agent job now.
 *
 * The scheduler dedupes recurring work per day or per ISO week, which is right
 * for a cron but wrong for operations: after deploying a new job kind there is
 * otherwise no way to exercise it until the next window comes round, and the
 * console form needs a browser session. Same authorisation as the tick and the
 * config API — the deployment secret or an admin session.
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

export async function POST(req: NextRequest) {
  if (!(await isAuthorized(req))) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: { agent?: string; kind?: string; drain?: boolean };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "body must be JSON" }, { status: 400 });
  }

  const agent = String(body.agent ?? "");
  const kind = String(body.kind ?? "");
  // Both are checked against the registries rather than trusted, so this can
  // only ever start work the application already knows how to do.
  if (!(AGENT_KEYS as readonly string[]).includes(agent)) {
    return NextResponse.json(
      { error: `unknown agent; expected one of ${AGENT_KEYS.join(", ")}` },
      { status: 400 },
    );
  }
  const handlers = HANDLERS[agent as AgentKey] ?? {};
  if (!Object.prototype.hasOwnProperty.call(handlers, kind)) {
    return NextResponse.json(
      { error: `unknown job for ${agent}; expected one of ${Object.keys(handlers).join(", ")}` },
      { status: 400 },
    );
  }

  await enqueue({
    agent: agent as AgentKey,
    kind,
    // Timestamped so an operator can always re-run, unlike the scheduler's
    // per-week keys — that is the entire point of this endpoint.
    dedupeKey: `manual:${agent}:${kind}:${Date.now()}`,
    priority: 1,
  });

  if (body.drain === false) {
    return NextResponse.json({ ok: true, queued: `${agent}/${kind}` });
  }
  // Drain immediately so the caller sees the outcome rather than a promise.
  const result = await heartbeat({ limit: 25, minGapSeconds: 0 });
  return NextResponse.json({ ok: true, queued: `${agent}/${kind}`, ...result });
}
