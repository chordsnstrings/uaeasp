import { NextResponse, type NextRequest } from "next/server";
import { and, eq, gt } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { EMIRATES, leadActivities, leads } from "@/db/schema";
import { normalizeEmail } from "@/lib/normalize";
import { checkRateLimit, hashIp } from "@/lib/rate-limit";
import { BUDGETS, INVOICE_VOLUMES, TIMELINES } from "@/lib/validation/lead";

export const runtime = "nodejs";

/** Enrichment is only accepted shortly after submission — the token is the
 * lead's own secret, and the window keeps it from becoming an edit API. */
const ENRICH_WINDOW_HOURS = 48;

const enrichSchema = z.object({
  trackingToken: z.string().uuid(),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .email()
    .max(200)
    .optional()
    .or(z.literal("").transform(() => undefined)),
  emirate: z
    .enum(EMIRATES)
    .optional()
    .or(z.literal("").transform(() => undefined)),
  invoiceVolume: z.enum(INVOICE_VOLUMES).optional(),
  budgetRange: z.enum(BUDGETS).optional(),
  timeline: z.enum(TIMELINES).optional(),
  accountingSoftware: z.string().trim().max(200).optional().or(z.literal("")),
  message: z.string().trim().max(2000).optional().or(z.literal("")),
});

export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const ipHash = ip === "unknown" ? null : hashIp(ip);
  if (ipHash && !(await checkRateLimit(`enrich:${ipHash}`, 10, 3600))) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  const parsed = enrichSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "validation" }, { status: 422 });
  }
  const d = parsed.data;

  const cutoff = new Date(Date.now() - ENRICH_WINDOW_HOURS * 3600 * 1000);
  const [lead] = await db
    .select()
    .from(leads)
    .where(and(eq(leads.trackingToken, d.trackingToken), gt(leads.createdAt, cutoff)))
    .limit(1);
  if (!lead) return NextResponse.json({ error: "not_found" }, { status: 404 });

  // Fill blanks only — enrichment never overwrites what sales may have edited.
  const updates: Partial<typeof leads.$inferInsert> = {};
  if (d.email && !lead.email) updates.email = normalizeEmail(d.email);
  if (d.emirate && !lead.emirate) updates.emirate = d.emirate;
  if (d.invoiceVolume && !lead.invoiceVolume) updates.invoiceVolume = d.invoiceVolume;
  if (d.budgetRange && !lead.budgetRange) updates.budgetRange = d.budgetRange;
  if (d.timeline && !lead.timeline) updates.timeline = d.timeline;
  if (d.accountingSoftware && !lead.accountingSoftware)
    updates.accountingSoftware = d.accountingSoftware;
  if (d.message && !lead.message) updates.message = d.message;

  if (Object.keys(updates).length === 0) return NextResponse.json({ ok: true });

  await db
    .update(leads)
    .set({ ...updates, updatedAt: new Date() })
    .where(eq(leads.id, lead.id));
  await db.insert(leadActivities).values({
    leadId: lead.id,
    userId: null,
    type: "note",
    body: `Client added details after submitting: ${Object.keys(updates).join(", ")}.`,
    meta: { enriched: Object.keys(updates) },
  });

  return NextResponse.json({ ok: true });
}
