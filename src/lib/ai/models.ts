import { eq } from "drizzle-orm";
import { db } from "@/db";
import { appSettings } from "@/db/schema";
import { getConfig } from "@/lib/settings";

/**
 * Per-job model routing.
 *
 * Every AI call in the system belongs to one of a handful of jobs, and each
 * job can name its own model. An empty override inherits the global model from
 * /admin/settings, so the default behaviour is unchanged and routing is purely
 * opt-in.
 *
 * The point is to spend precisely rather than uniformly: article drafting is
 * low-volume and public-facing, prospect scoring is high-volume and mechanical,
 * and those two deserve opposite ends of a price list.
 */

const CONFIG_KEY = "ai_models";

export const AI_JOBS = [
  {
    key: "scoring",
    label: "Prospect scoring",
    where: "Prospector — fit score, size and mandate wave",
    hint: "Highest volume, simplest task. A cheap, fast model saves the most here.",
  },
  {
    key: "classify",
    label: "Reply classification",
    where: "Conversationalist — routing an inbound reply",
    hint: "A routing decision, run at temperature 0. Accuracy matters more than prose.",
  },
  {
    key: "email",
    label: "Outreach writing",
    where: "Conversationalist — first touch, follow-ups, replies; Visibility — link pitches",
    hint: "Directly represents you in someone's inbox. Worth a capable model.",
  },
  {
    key: "article",
    label: "Article drafting",
    where: "Visibility — pages published to /insights",
    hint: "Low volume, public-facing, quality-sensitive. The best place for your strongest model.",
  },
  {
    key: "report",
    label: "Weekly report",
    where: "Analyst — narrative and recommendations",
    hint: "Once a week. Reasoning quality shows up directly in the advice.",
  },
  {
    key: "profile",
    label: "Provider profiles",
    where: "Directory refresh — bilingual profile drafts for new providers",
    hint: "Rare, bilingual. Needs solid Arabic.",
  },
] as const;

export type AiJob = (typeof AI_JOBS)[number]["key"];
export type JobModels = Record<AiJob, string>;

export const EMPTY_JOB_MODELS: JobModels = {
  scoring: "",
  classify: "",
  email: "",
  article: "",
  report: "",
  profile: "",
};

/** Pure resolution: a job's override wins, otherwise the global model. */
export function pickModel(
  overrides: Partial<JobModels>,
  job: AiJob | undefined,
  globalModel: string,
): string {
  if (!job) return globalModel;
  const override = overrides[job];
  return typeof override === "string" && override.trim() !== ""
    ? override.trim()
    : globalModel;
}

export async function getJobModels(): Promise<JobModels> {
  try {
    const [row] = await db
      .select()
      .from(appSettings)
      .where(eq(appSettings.key, CONFIG_KEY))
      .limit(1);
    const stored = (row?.value as Partial<JobModels>) ?? {};
    return { ...EMPTY_JOB_MODELS, ...stored };
  } catch {
    return { ...EMPTY_JOB_MODELS };
  }
}

export async function setJobModels(updates: Partial<JobModels>): Promise<void> {
  const current = await getJobModels();
  const next = { ...current, ...updates };
  await db
    .insert(appSettings)
    .values({ key: CONFIG_KEY, value: next, updatedAt: new Date() })
    .onConflictDoUpdate({
      target: appSettings.key,
      set: { value: next, updatedAt: new Date() },
    });
}

/** The model a given job should use right now. */
export async function resolveModel(job?: AiJob): Promise<string> {
  const [config, overrides] = await Promise.all([getConfig(), getJobModels()]);
  return pickModel(overrides, job, config.aiModel);
}
