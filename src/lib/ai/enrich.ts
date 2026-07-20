import { z } from "zod";
import { PROVIDER_CATEGORIES, type ProviderCategory } from "@/db/schema";
import { getConfig } from "@/lib/settings";

/**
 * Optional AI enrichment for providers that appear in a data refresh without
 * profile content. Uses any OpenAI-compatible chat API (DeepSeek, GLM/Zhipu,
 * Volcengine/BytePlus Ark, OpenAI, …) configured entirely via env vars:
 *
 *   AI_API_BASE_URL  either a provider base URL (…/v1/chat/completions is
 *                    appended) or a full chat-completions URL (used as-is
 *                    when it already ends in /chat/completions):
 *                      https://api.deepseek.com                       (DeepSeek)
 *                      https://open.bigmodel.cn/api/paas/v4/chat/completions  (GLM)
 *                      https://ark.cn-beijing.volces.com/api/v3/chat/completions  (Volcengine Ark)
 *                      https://ark.ap-southeast.bytepluses.com/api/v3/chat/completions  (BytePlus Ark)
 *   AI_API_KEY       provider API key
 *   AI_MODEL         e.g. deepseek-chat | glm-4-plus | deepseek-v3-250324 | ep-…
 *
 * When unset, enrichment is skipped and new providers show the neutral
 * fallback text until an admin fills the profile. Drafts NEVER overwrite
 * existing content — they only fill NULL description/category fields.
 */

export const enrichmentSchema = z.object({
  category: z.enum(PROVIDER_CATEGORIES),
  description_en: z.string().trim().min(40).max(900),
  description_ar: z.string().trim().min(40).max(1200),
});

export type Enrichment = z.infer<typeof enrichmentSchema>;

export async function isEnrichmentConfigured(): Promise<boolean> {
  const config = await getConfig();
  return !!(config.aiApiBaseUrl && config.aiApiKey && config.aiModel);
}

const SYSTEM_PROMPT = `You write short, factual company profiles for a directory of UAE Ministry of Finance pre-approved e-invoicing service providers (Accredited Service Providers / ASPs).

Rules:
- 2-3 sentences in English, then a faithful Arabic translation (Modern Standard Arabic).
- Only state what is verifiable from the company name, website domain and general public knowledge. If you know nothing about the company, write a neutral profile: what being a pre-approved UAE e-invoicing service provider means, mentioning the company name and website.
- NEVER invent client names, revenue figures, founding years, office locations or certifications.
- No marketing superlatives ("leading", "best-in-class").
- Classify into exactly one category: erp (accounting/ERP vendor), tax-tech (tax compliance platform), consulting (audit/advisory firm), edi-network (EDI or e-invoicing network operator), enterprise-software (broader enterprise software house), fintech (payments/AP automation).

Respond with ONLY a JSON object: {"category": "...", "description_en": "...", "description_ar": "..."}`;

/** Extract the first JSON object from a model response (handles code fences). */
export function parseEnrichment(raw: string): Enrichment | null {
  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    const parsed = enrichmentSchema.safeParse(JSON.parse(match[0]));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

export async function enrichProvider(input: {
  name: string;
  website: string | null;
}): Promise<{ category: ProviderCategory; description: string; descriptionAr: string } | null> {
  const config = await getConfig();
  if (!(config.aiApiBaseUrl && config.aiApiKey && config.aiModel)) return null;

  const baseUrl = config.aiApiBaseUrl.replace(/\/$/, "");
  const endpoint = baseUrl.endsWith("/chat/completions")
    ? baseUrl
    : `${baseUrl}/v1/chat/completions`;
  try {
    const res = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.aiApiKey}`,
      },
      body: JSON.stringify({
        model: config.aiModel,
        temperature: 0.2,
        // Generous budget: some hosted models (e.g. Seed/R1 family) spend
        // completion tokens on reasoning before the JSON answer.
        max_tokens: 2000,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          {
            role: "user",
            content: `Company: ${input.name}\nWebsite: ${input.website ?? "unknown"}`,
          },
        ],
      }),
      signal: AbortSignal.timeout(60000),
    });
    if (!res.ok) {
      console.error(`[ai-enrich] API returned ${res.status} for ${input.name}`);
      return null;
    }
    const data = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const content = data.choices?.[0]?.message?.content;
    if (!content) return null;
    const enrichment = parseEnrichment(content);
    if (!enrichment) {
      console.error(`[ai-enrich] unparseable response for ${input.name}`);
      return null;
    }
    return {
      category: enrichment.category,
      description: enrichment.description_en,
      descriptionAr: enrichment.description_ar,
    };
  } catch (err) {
    console.error(`[ai-enrich] failed for ${input.name}:`, err);
    return null;
  }
}

/** Cheap round-trip to verify the configured AI credentials actually work.
 * Returns the model's reply text on success, an error description otherwise. */
export async function testAiConnection(): Promise<{ ok: boolean; detail: string }> {
  const config = await getConfig();
  if (!(config.aiApiBaseUrl && config.aiApiKey && config.aiModel)) {
    return { ok: false, detail: "AI is not fully configured — base URL, API key and model are all required." };
  }
  const baseUrl = config.aiApiBaseUrl.replace(/\/$/, "");
  const endpoint = baseUrl.endsWith("/chat/completions")
    ? baseUrl
    : `${baseUrl}/v1/chat/completions`;
  try {
    const res = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.aiApiKey}`,
      },
      body: JSON.stringify({
        model: config.aiModel,
        max_tokens: 400,
        messages: [{ role: "user", content: "Reply with exactly: OK" }],
      }),
      signal: AbortSignal.timeout(30000),
    });
    if (!res.ok) {
      const body = (await res.text()).slice(0, 200);
      return { ok: false, detail: `API returned HTTP ${res.status}: ${body}` };
    }
    const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    const content = data.choices?.[0]?.message?.content?.trim();
    if (!content) return { ok: false, detail: "API responded but returned no message content." };
    return { ok: true, detail: `Model ${config.aiModel} responded: "${content.slice(0, 60)}"` };
  } catch (err) {
    return { ok: false, detail: err instanceof Error ? err.message : String(err) };
  }
}
