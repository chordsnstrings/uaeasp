import { NextResponse, type NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { getConfig } from "@/lib/settings";
import { getAgentConfig } from "@/lib/agents/config";
import { heartbeat } from "@/lib/agents/heartbeat";
import { queueDepth } from "@/lib/agents/queue";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * The agent heartbeat.
 *
 * An external entry point to the same beat the app runs internally every few
 * minutes: nightly directory refresh, then periodic agent work and a bounded
 * slice of the queue. Bounded on purpose — a tick that never ends is a tick
 * that cannot be reasoned about. Redundant with the internal timer by design;
 * the slot claim stops them doubling up.
 */

async function isAuthorized(req: NextRequest): Promise<boolean> {
  const bearer = req.headers.get("authorization");
  // The deployment secret is accepted directly as well as the effective
  // (possibly admin-overridden) one, so the app's own scheduler keeps working
  // after someone rotates the value in /admin/settings.
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

  const limit = Math.min(
    Math.max(Number(req.nextUrl.searchParams.get("limit") ?? 15), 1),
    50,
  );

  // The app beats its own clock too, so a short gap keeps an external cron
  // from doubling up on work the internal timer just did.
  const result = await heartbeat({ limit, minGapSeconds: 45 });
  return NextResponse.json({ ok: true, ...result });
}

export async function GET() {
  const [config, depth] = await Promise.all([getAgentConfig(), queueDepth()]);
  return NextResponse.json({ enabled: config.agentsEnabled, depth });
}
