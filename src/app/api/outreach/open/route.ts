import { NextResponse, type NextRequest } from "next/server";
import { eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { outreachMessages } from "@/db/schema";
import { PIXEL } from "@/lib/agents/tracking";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Open pixel.
 *
 * Always returns the image, whatever happens. A tracking failure must never
 * show a recipient a broken image in an email we sent them, so every error
 * path still serves the GIF and the recording is best-effort.
 */
export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("t");
  if (token && /^[0-9a-f-]{36}$/i.test(token)) {
    try {
      await db
        .update(outreachMessages)
        .set({
          // First open wins the timestamp; later ones only raise the count.
          openedAt: sql`COALESCE(${outreachMessages.openedAt}, now())`,
          openCount: sql`${outreachMessages.openCount} + 1`,
        })
        .where(eq(outreachMessages.trackToken, token));
    } catch {
      // Swallowed on purpose — see above.
    }
  }
  return new NextResponse(PIXEL, {
    status: 200,
    headers: {
      "Content-Type": "image/gif",
      "Content-Length": String(PIXEL.length),
      // Without this the proxy caches the pixel and later opens never arrive.
      "Cache-Control": "no-store, no-cache, must-revalidate, private",
      Pragma: "no-cache",
    },
  });
}
