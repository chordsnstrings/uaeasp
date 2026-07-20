import type { MetadataRoute } from "next";
import { getPublicProviders } from "@/lib/data";
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
