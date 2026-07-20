import { NextResponse, type NextRequest } from "next/server";
import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { leads } from "@/db/schema";
import { normalizeEmail, normalizePhone } from "@/lib/normalize";
import { checkRateLimit, hashIp } from "@/lib/rate-limit";

export const runtime = "nodejs";

const lookupSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  phone: z.string().trim().min(7).max(24),
});

export async function POST(req: NextRequest) {
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  // Strict limit: this endpoint must not be usable to enumerate leads.
  const allowed = await checkRateLimit(`track:${hashIp(ip)}`, 10, 3600);
  if (!allowed) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  const parsed = lookupSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "validation" }, { status: 422 });
  }

  const [lead] = await db
    .select({ trackingToken: leads.trackingToken })
    .from(leads)
    .where(
      and(
        eq(leads.email, normalizeEmail(parsed.data.email)),
        eq(leads.phone, normalizePhone(parsed.data.phone)),
      ),
    )
    .orderBy(desc(leads.createdAt))
    .limit(1);

  if (!lead) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  return NextResponse.json({ ok: true, token: lead.trackingToken });
}
