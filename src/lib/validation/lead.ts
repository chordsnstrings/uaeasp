import { z } from "zod";
import { EMIRATES } from "@/db/schema";

export const INVOICE_VOLUMES = ["lt100", "100-1000", "1000-10000", "gt10000"] as const;
export const BUDGETS = ["economy", "mid", "premium", "unsure"] as const;
export const TIMELINES = ["asap", "3months", "6months", "exploring"] as const;

// Conversion-first: only name, phone and company are required. Everything
// else is optional and can be enriched later (thank-you step or by sales).
export const leadSchema = z.object({
  fullName: z.string().trim().min(2).max(120),
  companyName: z.string().trim().min(2).max(160),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .email()
    .max(200)
    .optional()
    .or(z.literal("").transform(() => undefined)),
  phone: z
    .string()
    .trim()
    .regex(/^[+\d][\d\s\-()]{6,20}$/, "invalid phone"),
  emirate: z
    .enum(EMIRATES)
    .optional()
    .or(z.literal("").transform(() => undefined)),
  invoiceVolume: z.enum(INVOICE_VOLUMES).optional(),
  accountingSoftware: z.string().trim().max(200).optional().or(z.literal("")),
  budgetRange: z.enum(BUDGETS).optional(),
  timeline: z.enum(TIMELINES).optional(),
  message: z.string().trim().max(2000).optional().or(z.literal("")),
  // Submitting the form is the consent action; the privacy note next to the
  // button states it. Kept optional for backwards compatibility.
  consent: z.boolean().optional(),
  locale: z.enum(["en", "ar"]).default("en"),
  source: z.string().trim().max(120).default("form"),
  quizAnswers: z.record(z.string(), z.string()).optional(),
  quizScore: z.number().int().min(0).max(100).optional(),
  utm: z.record(z.string(), z.string()).optional(),
  referrer: z.string().max(500).optional(),
  // Anti-spam: honeypot must stay empty; renderedAt is the form render time
  website: z.string().max(0).optional().or(z.literal("")),
  renderedAt: z.number().int().positive(),
  turnstileToken: z.string().optional(),
});

export type LeadInput = z.infer<typeof leadSchema>;
