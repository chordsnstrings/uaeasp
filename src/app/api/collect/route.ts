import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { analyticsEvents } from "@/db/schema";

export const runtime = "nodejs";

const BOT_UA_RE =
  /bot|crawl|spider|slurp|bingpreview|facebookexternalhit|whatsapp|telegram|preview|headless|lighthouse|pingdom|uptime|monitor|curl|wget|python-requests|axios|go-http/i;

const payloadSchema = z.object({
  type: z.enum(["pageview", "event"]),
  name: z.string().trim().max(60).optional(),
  path: z.string().trim().min(1).max(300),
  locale: z.enum(["en", "ar"]).optional(),
  sessionId: z.string().trim().min(8).max(64),
  referrer: z.string().trim().max(500).optional(),
  utmSource: z.string().trim().max(120).optional(),
  utmMedium: z.string().trim().max(120).optional(),
  utmCampaign: z.string().trim().max(120).optional(),
  screenW: z.number().int().min(0).max(20000).optional(),
});

function referrerHost(raw: string | undefined, ownHost: string | null): string | null {
  if (!raw) return null;
  try {
    const host = new URL(raw).hostname.replace(/^www\./, "");
    if (!host || (ownHost && host === ownHost)) return null;
    return host.slice(0, 200);
  } catch {
    return null;
  }
}

export async function POST(req: NextRequest) {
  const ua = req.headers.get("user-agent") ?? "";
  if (!ua || BOT_UA_RE.test(ua)) return NextResponse.json({ ok: true });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
  const parsed = payloadSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ ok: false }, { status: 422 });
  const d = parsed.data;

  // Only track our own pages; never the admin.
  if (!d.path.startsWith("/") || d.path.startsWith("/admin")) {
    return NextResponse.json({ ok: true });
  }

  const ownHost = (() => {
    try {
      return new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "").hostname.replace(/^www\./, "");
    } catch {
      return null;
    }
  })();

  try {
    await db.insert(analyticsEvents).values({
      type: d.type,
      name: d.type === "event" ? (d.name ?? "unnamed") : null,
      path: d.path.split("?")[0].slice(0, 300),
      locale: d.locale ?? null,
      sessionId: d.sessionId,
      referrerHost: referrerHost(d.referrer, ownHost),
      utmSource: d.utmSource?.toLowerCase() ?? null,
      utmMedium: d.utmMedium?.toLowerCase() ?? null,
      utmCampaign: d.utmCampaign?.toLowerCase() ?? null,
      device: d.screenW === undefined ? null : d.screenW < 768 ? "mobile" : "desktop",
    });
  } catch (err) {
    // Analytics must never break the site — swallow storage errors.
    console.error("[collect] insert failed:", err instanceof Error ? err.message : err);
  }
  return NextResponse.json({ ok: true });
}
