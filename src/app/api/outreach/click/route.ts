import { NextResponse, type NextRequest } from "next/server";
import { eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { outreachMessages } from "@/db/schema";
import { safeRedirectPath } from "@/lib/agents/tracking";
import { absoluteUrl } from "@/lib/site";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Click redirect.
 *
 * Records the click, then sends the visitor on. The destination is validated
 * as one of our own paths rather than trusted: a tracker that will forward to
 * any URL is an open redirect, and an open redirect on a domain that sends
 * mail is exactly what a phisher wants. An unrecognised target falls back to
 * the homepage instead of erroring, because the person clicked in good faith.
 */
export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("t");
  const target = safeRedirectPath(req.nextUrl.searchParams.get("u") ?? "");

  if (token && /^[0-9a-f-]{36}$/i.test(token)) {
    try {
      await db
        .update(outreachMessages)
        .set({
          firstClickAt: sql`COALESCE(${outreachMessages.firstClickAt}, now())`,
          clickCount: sql`${outreachMessages.clickCount} + 1`,
          // A click proves delivery, so it also backfills an open that image
          // blocking would otherwise have hidden.
          openedAt: sql`COALESCE(${outreachMessages.openedAt}, now())`,
        })
        .where(eq(outreachMessages.trackToken, token));
    } catch {
      // Never block the redirect on a bookkeeping failure.
    }
  }
  return NextResponse.redirect(absoluteUrl(target ?? "/"), { status: 302 });
}
