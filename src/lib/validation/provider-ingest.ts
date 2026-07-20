import { z } from "zod";

export const ingestContactSchema = z.object({
  name: z.string().trim().max(160).optional(),
  emails: z.array(z.string().trim().max(200)).max(10).default([]),
  phones: z.array(z.string().trim().max(40)).max(10).default([]),
});

export const ingestProviderSchema = z.object({
  name: z.string().trim().min(2).max(300),
  website: z.string().trim().max(500).nullish(),
  contacts: z.array(ingestContactSchema).max(10).optional(),
});

export const ingestPayloadSchema = z.object({
  strategy: z.enum(["scrape_html", "scrape_pdf", "manual"]),
  scrapedAt: z.string().datetime().optional(),
  triggeredBy: z.string().max(60).default("cron"),
  providers: z.array(ingestProviderSchema).max(500),
});

export const ingestFailureSchema = z.object({
  status: z.literal("failed"),
  strategy: z.enum(["scrape_html", "scrape_pdf", "manual"]).optional(),
  triggeredBy: z.string().max(60).default("cron"),
  error: z.string().max(5000),
});

export type IngestPayload = z.infer<typeof ingestPayloadSchema>;
export type IngestFailure = z.infer<typeof ingestFailureSchema>;
