import { and, eq, gt, or } from "drizzle-orm";
import { db } from "@/db";
import { leadActivities, leads, type Lead } from "@/db/schema";
import { normalizeEmail, normalizePhone } from "@/lib/normalize";
import type { LeadInput } from "@/lib/validation/lead";

const DEDUPE_WINDOW_DAYS = 14;

/**
 * Insert a lead with duplicate detection. Duplicates (same email OR phone in
 * the last 14 days) are still stored — sales decides what to do — but flagged
 * and linked to the original.
 */
export async function createLead(
  input: LeadInput,
  meta: { ipHash: string | null },
): Promise<Lead> {
  const email = normalizeEmail(input.email);
  const phone = normalizePhone(input.phone);
  const cutoff = new Date(Date.now() - DEDUPE_WINDOW_DAYS * 24 * 3600 * 1000);

  const [existing] = await db
    .select({ id: leads.id })
    .from(leads)
    .where(
      and(
        or(eq(leads.email, email), eq(leads.phone, phone)),
        gt(leads.createdAt, cutoff),
      ),
    )
    .orderBy(leads.createdAt)
    .limit(1);

  const [lead] = await db
    .insert(leads)
    .values({
      fullName: input.fullName,
      companyName: input.companyName,
      email,
      phone,
      emirate: input.emirate,
      invoiceVolume: input.invoiceVolume ?? null,
      accountingSoftware: input.accountingSoftware || null,
      budgetRange: input.budgetRange ?? null,
      timeline: input.timeline ?? null,
      message: input.message || null,
      source: input.source,
      quizAnswers: input.quizAnswers ?? null,
      quizScore: input.quizScore ?? null,
      locale: input.locale,
      utm: input.utm ?? null,
      referrer: input.referrer ?? null,
      consentAt: new Date(),
      duplicateOf: existing?.id ?? null,
      flaggedDuplicate: !!existing,
      ipHash: meta.ipHash,
    })
    .returning();

  await db.insert(leadActivities).values({
    leadId: lead.id,
    userId: null,
    type: "created",
    body: existing
      ? `Lead submitted (flagged as possible duplicate of an earlier lead).`
      : "Lead submitted via website.",
    meta: { source: input.source },
  });

  return lead;
}
