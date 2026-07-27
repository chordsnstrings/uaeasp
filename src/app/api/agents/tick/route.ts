import { NextResponse, type NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { getConfig } from "@/lib/settings";
import { getAgentConfig } from "@/lib/agents/config";
import { drainQueue } from "@/lib/agents/runner";
import { queueDepth, reclaimStale } from "@/lib/agents/queue";
import { scheduleDueWork } from "@/lib/agents/scheduler";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * The agent heartbeat.
 *
 * Called on a schedule (GitHub Actions cron) or by hand from the admin
 * console. Each tick: recover anything a crashed run left claimed, enqueue any
 * periodic work that is due, then drain a bounded slice of the queue. Bounded
 * on purpose — a tick that never ends is a tick that cannot be reasoned about.
 */

async function isAuthorized(req: NextRequest): Promise<boolean> {
  const bearer = req.headers.get("authorization");
  const { ingestSecret } = await getConfig();
  if (ingestSecret && bearer === `Bearer ${ingestSecret}`) return true;
  const session = await auth();
  return session?.user?.role === "admin";
}

export async function POST(req: NextRequest) {
  if (!(await isAuthorized(req))) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const config = await getAgentConfig();
  if (!config.agentsEnabled) {
    return NextResponse.json({ ok: true, skipped: "agents disabled" });
  }

  const limit = Math.min(
    Math.max(Number(req.nextUrl.searchParams.get("limit") ?? 15), 1),
    50,
  );

  const started = Date.now();
  const reclaimed = await reclaimStale();
  const scheduled = await scheduleDueWork();
  const processed = await drainQueue(limit);
  const depth = await queueDepth();

  return NextResponse.json({
    ok: true,
    reclaimed,
    scheduled,
    processed,
    depth,
    ms: Date.now() - started,
  });
}

export async function GET() {
  const [config, depth] = await Promise.all([getAgentConfig(), queueDepth()]);
  return NextResponse.json({ enabled: config.agentsEnabled, depth });
}
