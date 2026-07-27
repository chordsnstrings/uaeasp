import { NextResponse, type NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { outreachThreads } from "@/db/schema";
import { suppress } from "@/lib/agents/mailer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * One-click unsubscribe. GET renders a confirmation page (a human clicked the
 * footer link); POST is the RFC 8058 List-Unsubscribe-Post path mail clients
 * call without asking. Both suppress permanently and close the thread.
 */

async function unsubscribeByToken(token: string): Promise<string | null> {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(token)) {
    return null;
  }
  const [thread] = await db
    .select({ email: outreachThreads.toEmail })
    .from(outreachThreads)
    .where(eq(outreachThreads.token, token))
    .limit(1);
  if (!thread) return null;
  await suppress(thread.email, "unsubscribe", "one-click");
  return thread.email;
}

export async function POST(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("t") ?? "";
  const email = await unsubscribeByToken(token);
  // One-click clients want JSON; a human coming from the confirm page wants a page.
  if ((req.headers.get("accept") ?? "").includes("text/html")) {
    return new NextResponse(
      `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="robots" content="noindex"><title>Unsubscribed</title><style>
        body{margin:0;min-height:100vh;display:grid;place-items:center;background:#faf8f3;color:#0f172a;font:16px/1.6 ui-sans-serif,system-ui,sans-serif;padding:24px}
        main{max-width:32rem;background:#fff;border:1px solid #e2e8f0;border-radius:10px;padding:32px}
      </style></head><body><main><h1>You're unsubscribed</h1><p>${
        email ? `<strong>${escapeHtml(email)}</strong> will not receive any further email from us.` : "That link is no longer valid."
      }</p></main></body></html>`,
      { status: email ? 200 : 404, headers: { "Content-Type": "text/html; charset=utf-8" } },
    );
  }
  return NextResponse.json({ ok: !!email });
}

/** Does this token belong to a thread, without changing anything? */
async function tokenExists(token: string): Promise<boolean> {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(token)) {
    return false;
  }
  const [thread] = await db
    .select({ id: outreachThreads.id })
    .from(outreachThreads)
    .where(eq(outreachThreads.token, token))
    .limit(1);
  return !!thread;
}

/**
 * GET only asks. Corporate link scanners, spam filters and mail-client
 * prefetchers request every URL in a message, so acting on GET would opt people
 * out who never clicked. The button posts, which is also the RFC 8058 path.
 */
export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("t") ?? "";
  const known = await tokenExists(token);
  const body = known
    ? `<h1>Unsubscribe?</h1><p>Confirm and we will never email this address again.</p>
       <form method="post" action="/api/outreach/unsubscribe?t=${encodeURIComponent(token)}">
         <button type="submit">Yes, unsubscribe me</button>
       </form>`
    : `<h1>Link expired</h1><p>We couldn't find that subscription. If you still receive email from us, reply with the word STOP and we'll remove you.</p>`;

  return new NextResponse(
    `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>Unsubscribe</title><style>
      body{margin:0;min-height:100vh;display:grid;place-items:center;background:#faf8f3;color:#0f172a;font:16px/1.6 ui-sans-serif,system-ui,sans-serif;padding:24px}
      main{max-width:32rem;background:#fff;border:1px solid #e2e8f0;border-radius:10px;padding:32px}
      h1{font-size:1.4rem;margin:0 0 12px}p{margin:0 0 16px;color:#475569}a{color:#0f766e}
      button{background:#0f766e;color:#fff;border:0;border-radius:8px;padding:11px 20px;font:inherit;font-weight:600;cursor:pointer}
    </style></head><body><main>${body}<p style="margin-top:20px"><a href="/">Return to the directory</a></p></main></body></html>`,
    { status: known ? 200 : 404, headers: { "Content-Type": "text/html; charset=utf-8" } },
  );
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] ?? c,
  );
}
