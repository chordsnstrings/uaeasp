import { NextResponse, after, type NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { sendEmail, getAdminAlertEmail } from "@/lib/email";
import { scrapeAlertEmail } from "@/lib/email/templates";
import { recordFailedRun } from "@/lib/ingest/reconcile";
import { processIngestPayload } from "@/lib/ingest/process";
import { getConfig } from "@/lib/settings";
import {
  ingestFailureSchema,
  ingestPayloadSchema,
} from "@/lib/validation/provider-ingest";

export const runtime = "nodejs";
export const maxDuration = 120;

async function isAuthorized(req: NextRequest): Promise<boolean> {
  const bearer = req.headers.get("authorization");
  const { ingestSecret } = await getConfig();
  if (ingestSecret && bearer === `Bearer ${ingestSecret}`) return true;
  // Admins may upload the list manually through the same endpoint.
  const session = await auth();
  return session?.user?.role === "admin";
}

export async function POST(req: NextRequest) {
  if (!(await isAuthorized(req))) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  // Failure report from the scraper (all strategies exhausted)
  const failure = ingestFailureSchema.safeParse(body);
  if (failure.success) {
    const { runId, consecutiveFailures } = await recordFailedRun({
      error: failure.data.error,
      strategy: failure.data.strategy,
      triggeredBy: failure.data.triggeredBy,
    });
    after(async () => {
      const { subject, html, text } = scrapeAlertEmail({
        status: "failed",
        summary: failure.data.error.slice(0, 200),
        detailLines:
          consecutiveFailures >= 2
            ? [
                `⚠️ ${consecutiveFailures} consecutive failures — check the workflow and the source site.`,
              ]
            : ["First failure — the next scheduled run may recover on its own."],
      });
      await sendEmail({ to: await getAdminAlertEmail(), subject, html, text });
    });
    return NextResponse.json({ ok: true, runId, recorded: "failed" });
  }

  const parsed = ingestPayloadSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "validation", issues: parsed.error.flatten() },
      { status: 422 },
    );
  }

  const result = await processIngestPayload(parsed.data);

  return NextResponse.json({
    ok: result.status === "success",
    ...result,
  });
}
