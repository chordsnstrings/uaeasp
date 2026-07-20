import { after } from "next/server";
import { revalidatePath, revalidateTag } from "next/cache";
import { eq, isNull, inArray, and } from "drizzle-orm";
import { db } from "@/db";
import { providers } from "@/db/schema";
import { enrichProvider, isEnrichmentConfigured } from "@/lib/ai/enrich";
import { writeAudit } from "@/lib/audit";
import { sendEmail, getAdminAlertEmail } from "@/lib/email";
import { scrapeAlertEmail } from "@/lib/email/templates";
import { reconcileProviders, type ReconcileResult } from "@/lib/ingest/reconcile";
import { PROVIDERS_CACHE_TAG } from "@/lib/data";
import type { IngestPayload } from "@/lib/validation/provider-ingest";

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
    await sendEmail({ to: await getAdminAlertEmail(), subject, html, text });
  });
}

/**
 * Run a validated ingest payload through reconciliation plus all side
 * effects: sitewide cache revalidation, optional AI enrichment of newly
 * added providers, and admin alert emails. Shared by the ingest API route
 * (nightly workflow) and the admin "Refresh now" action.
 */
export async function processIngestPayload(payload: IngestPayload): Promise<ReconcileResult> {
  const result = await reconcileProviders(payload);

  if (result.status === "success") {
    // Bust both the data cache and the page cache so the change is visible
    // sitewide immediately (counts, titles, registry, profiles, sitemap).
    revalidateTag(PROVIDERS_CACHE_TAG);
    revalidatePath("/", "layout");

    // Optional AI enrichment: newly added providers arrive from the official
    // list with only name/website/contacts. Draft a profile (EN + AR +
    // category) for them — filling NULL fields only, never overwriting
    // existing or admin-edited content. Skipped when no AI key is configured.
    if (result.addedNames.length > 0 && (await isEnrichmentConfigured())) {
      after(async () => {
        const blank = await db
          .select({
            id: providers.id,
            name: providers.name,
            website: providers.website,
          })
          .from(providers)
          .where(
            and(inArray(providers.name, result.addedNames), isNull(providers.description)),
          );
        let enriched = 0;
        for (const p of blank) {
          const draft = await enrichProvider({ name: p.name, website: p.website });
          if (!draft) continue;
          await db
            .update(providers)
            .set({
              description: draft.description,
              descriptionAr: draft.descriptionAr,
              category: draft.category,
              updatedAt: new Date(),
            })
            .where(and(eq(providers.id, p.id), isNull(providers.description)));
          await writeAudit({
            userId: null,
            action: "provider.ai_enrich",
            entity: "provider",
            entityId: p.id,
            diff: { category: draft.category },
          });
          enriched++;
        }
        if (enriched > 0) {
          revalidateTag(PROVIDERS_CACHE_TAG);
          revalidatePath("/", "layout");
          console.log(`[ai-enrich] drafted ${enriched} new provider profile(s)`);
        }
      });
    }
  }
  notifyAfterRun(result);

  return result;
}
