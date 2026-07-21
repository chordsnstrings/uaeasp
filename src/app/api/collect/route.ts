import { createHash, randomBytes } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { analyticsEvents } from "@/db/schema";
import { checkRateLimit } from "@/lib/rate-limit";

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

// When IP_HASH_SALT is unset (dev/preview), use a random per-process salt
// instead of a public constant — hashes stay non-reversible, at the cost of
// visitor continuity across restarts in those environments only.
const FALLBACK_SALT = randomBytes(16).toString("hex");

/** Client IP as seen by our edge. do-connecting-ip is set by DigitalOcean's
 * load balancer and is trusted; the X-Forwarded-For fallback takes the LAST
 * hop (appended by the nearest proxy) rather than the client-controlled
 * first entry. Spoofing beyond that is bounded by the rate limit below. */
function clientIp(req: NextRequest): string {
  const doIp = req.headers.get("do-connecting-ip");
  if (doIp) return doIp.trim();
  const xff = req.headers.get("x-forwarded-for");
  if (xff) {
    const hops = xff.split(",").map((s) => s.trim()).filter(Boolean);
    if (hops.length > 0) return hops[hops.length - 1];
  }
  return "unknown";
}

/** Privacy-safe unique-visitor id: salted hash of IP + UA + Dubai calendar
 * day. The IP is never stored and the id changes every day by construction,
 * so it can count daily uniques but cannot track anyone over time. */
function visitorId(ip: string, ua: string): string {
  const day = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Dubai",
    dateStyle: "short",
  }).format(new Date());
  const salt = process.env.IP_HASH_SALT || FALLBACK_SALT;
  return createHash("sha256").update(`${salt}|${ip}|${ua}|${day}`).digest("hex").slice(0, 32);
}

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

  const ip = clientIp(req);

  // Bound abuse: an IP writing more than this is not a human browsing.
  // Silently accept-and-drop over the limit so scripts learn nothing.
  const ipKey = createHash("sha256")
    .update(`${process.env.IP_HASH_SALT || FALLBACK_SALT}|${ip}`)
    .digest("hex")
    .slice(0, 24);
  try {
    if (!(await checkRateLimit(`collect:${ipKey}`, 240, 3600))) {
      return NextResponse.json({ ok: true });
    }
  } catch {
    // Rate-limit table unavailable — fail open, storage still guarded below.
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
      visitorId: visitorId(ip, ua),
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

  // Probabilistic retention sweep: ~1 in 500 requests prunes events older
  // than a year, keeping the table bounded without a separate cron.
  if (Math.random() < 0.002) {
    void db
      .execute(sql`DELETE FROM analytics_events WHERE created_at < now() - interval '365 days'`)
      .catch(() => undefined);
  }

  return NextResponse.json({ ok: true });
}
