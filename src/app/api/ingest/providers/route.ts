import { NextResponse, after, type NextRequest } from "next/server";
import { revalidateTag } from "next/cache";
import { auth } from "@/lib/auth";
import { sendEmail, getAdminAlertEmail } from "@/lib/email";
import { scrapeAlertEmail } from "@/lib/email/templates";
import {
  recordFailedRun,
  reconcileProviders,
  type ReconcileResult,
} from "@/lib/ingest/reconcile";
import { PROVIDERS_CACHE_TAG } from "@/lib/data";
import {
  ingestFailureSchema,
  ingestPayloadSchema,
} from "@/lib/validation/provider-ingest";

export const runtime = "nodejs";
export const maxDuration = 120;

async function isAuthorized(req: NextRequest): Promise<boolean> {
  const bearer = req.headers.get("authorization");
  const secret = process.env.INGEST_SECRET;
  if (secret && bearer === `Bearer ${secret}`) return true;
  // Admins may upload the list manually through the same endpoint.
  const session = await auth();
  return session?.user?.role === "admin";
}

function notifyAfterRun(result: ReconcileResult) {
  const shouldAlert =
    result.status === "rejected" ||
    result.addedNames.length > 0 ||
    result.delisted.length > 0 ||
    result.restored.length > 0;
  if (!shouldAlert) return;

  after(async () => {
    const lines: string[] = [];
    for (const name of result.addedNames) lines.push(`Added: ${name}`);
    for (const name of result.delisted) lines.push(`Delisted (missing ${2}+ runs): ${name}`);
    for (const name of result.restored) lines.push(`Restored: ${name}`);
    if (result.rejectedReason) lines.push(result.rejectedReason);
    if (result.status === "rejected" && result.consecutiveFailures >= 2) {
      lines.push(
        `⚠️ ${result.consecutiveFailures} consecutive failed/rejected refreshes — the directory may be getting stale. Manual review needed.`,
      );
    }
    const { subject, html, text } = scrapeAlertEmail({
      status: result.status,
      summary: `${result.found} providers found · +${result.added} added · ${result.updated} updated · ${result.missing} missing`,
      detailLines: lines,
    });
    await sendEmail({ to: getAdminAlertEmail(), subject, html, text });
  });
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
      await sendEmail({ to: getAdminAlertEmail(), subject, html, text });
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

  const result = await reconcileProviders(parsed.data);

  if (result.status === "success") {
    revalidateTag(PROVIDERS_CACHE_TAG);
  }
  notifyAfterRun(result);

  return NextResponse.json({
    ok: result.status === "success",
    ...result,
  });
}
