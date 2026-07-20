import { z } from "zod";
import { PROVIDER_CATEGORIES, type ProviderCategory } from "@/db/schema";

/**
 * Optional AI enrichment for providers that appear in a data refresh without
 * profile content. Uses any OpenAI-compatible chat API (DeepSeek, GLM/Zhipu,
 * OpenAI, …) configured entirely via env vars:
 *
 *   AI_API_BASE_URL  e.g. https://api.deepseek.com  (DeepSeek)
 *                         https://open.bigmodel.cn/api/paas  (GLM)
 *   AI_API_KEY       provider API key
 *   AI_MODEL         e.g. deepseek-chat | glm-4-plus
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

export function isEnrichmentConfigured(): boolean {
  return !!(process.env.AI_API_BASE_URL && process.env.AI_API_KEY && process.env.AI_MODEL);
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
  if (!isEnrichmentConfigured()) return null;

  const baseUrl = process.env.AI_API_BASE_URL!.replace(/\/$/, "");
  try {
    const res = await fetch(`${baseUrl}/v1/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.AI_API_KEY}`,
      },
      body: JSON.stringify({
        model: process.env.AI_MODEL,
        temperature: 0.2,
        max_tokens: 800,
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
