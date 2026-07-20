import type { MetadataRoute } from "next";
import { absoluteUrl } from "@/lib/site";

const BLOCKED_PATHS = ["/admin", "/api/", "/track/", "/thank-you"];

// AI/LLM crawlers we explicitly welcome — being cited in AI answers is a
// distribution channel for this directory. The public JSON feed stays
// accessible via an explicit allow despite the /api/ disallow.
const AI_CRAWLERS = [
  "GPTBot",
  "OAI-SearchBot",
  "ChatGPT-User",
  "ClaudeBot",
  "Claude-Web",
  "anthropic-ai",
  "PerplexityBot",
  "Google-Extended",
  "Applebot-Extended",
  "CCBot",
  "cohere-ai",
  "Meta-ExternalAgent",
  "Amazonbot",
];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/api/providers.json"],
        disallow: BLOCKED_PATHS,
      },
      ...AI_CRAWLERS.map((userAgent) => ({
        userAgent,
        allow: ["/", "/api/providers.json"],
        disallow: BLOCKED_PATHS,
      })),
    ],
    sitemap: absoluteUrl("/sitemap.xml"),
  };
}
