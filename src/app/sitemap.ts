import type { MetadataRoute } from "next";
import { getPublicProviders } from "@/lib/data";
import { GUIDE_SLUGS, GUIDE_UPDATED_ISO } from "@/content/guides";
import { EMIRATES, PROVIDER_CATEGORIES } from "@/db/schema";
import { absoluteUrl, localePath } from "@/lib/site";

export const revalidate = 3600;

function entry(
  path: string,
  opts: { priority: number; changeFrequency: MetadataRoute.Sitemap[0]["changeFrequency"]; lastModified?: Date },
): MetadataRoute.Sitemap[0] {
  return {
    url: absoluteUrl(localePath("en", path)),
    lastModified: opts.lastModified ?? new Date(),
    changeFrequency: opts.changeFrequency,
    priority: opts.priority,
    alternates: {
      languages: {
        en: absoluteUrl(localePath("en", path)),
        ar: absoluteUrl(localePath("ar", path)),
      },
    },
  };
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const providers = await getPublicProviders();

  return [
    entry("/", { priority: 1, changeFrequency: "daily" }),
    entry("/providers", { priority: 0.9, changeFrequency: "daily" }),
    entry("/registry", { priority: 0.9, changeFrequency: "daily" }),
    entry("/get-matched", { priority: 0.9, changeFrequency: "monthly" }),
    entry("/assessment", { priority: 0.8, changeFrequency: "monthly" }),
    entry("/faq", { priority: 0.8, changeFrequency: "weekly" }),
    entry("/toolkit", { priority: 0.8, changeFrequency: "monthly" }),
    entry("/toolkit/penalty-calculator", { priority: 0.8, changeFrequency: "monthly" }),
    entry("/toolkit/readiness-planner", { priority: 0.8, changeFrequency: "monthly" }),
    entry("/toolkit/checklist", { priority: 0.7, changeFrequency: "monthly" }),
    entry("/guides", { priority: 0.8, changeFrequency: "weekly" }),
    ...GUIDE_SLUGS.map((slug) =>
      entry(`/guides/${slug}`, {
        priority: 0.7,
        changeFrequency: "monthly",
        lastModified: new Date(GUIDE_UPDATED_ISO),
      }),
    ),
    ...PROVIDER_CATEGORIES.map((category) =>
      entry(`/providers/category/${category}`, { priority: 0.7, changeFrequency: "weekly" }),
    ),
    ...EMIRATES.map((emirate) =>
      entry(`/e-invoicing/${emirate}`, { priority: 0.8, changeFrequency: "monthly" }),
    ),
    entry("/integrations", { priority: 0.7, changeFrequency: "monthly" }),
    entry("/resources", { priority: 0.6, changeFrequency: "monthly" }),
    entry("/resources/pint-ae-reference", { priority: 0.7, changeFrequency: "monthly" }),
    entry("/resources/glossary", { priority: 0.6, changeFrequency: "monthly" }),
    entry("/about", { priority: 0.4, changeFrequency: "monthly" }),
    entry("/privacy", { priority: 0.2, changeFrequency: "yearly" }),
    entry("/disclaimer", { priority: 0.2, changeFrequency: "yearly" }),
    ...providers.map((p) =>
      entry(`/providers/${p.slug}`, {
        priority: 0.7,
        changeFrequency: "weekly",
        lastModified: new Date(p.updatedAt),
      }),
    ),
  ];
}
