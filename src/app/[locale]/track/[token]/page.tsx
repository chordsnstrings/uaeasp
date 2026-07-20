import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { db } from "@/db";
import { leads, users } from "@/db/schema";
import type { Locale } from "@/lib/site";
import { Link } from "@/i18n/navigation";
import { FadeIn, StaggerGroup, StaggerItem } from "@/components/motion";

export const dynamic = "force-dynamic";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Map internal pipeline statuses to client-safe step numbers (1-4). */
const STATUS_STEP: Record<string, number> = {
  new: 1,
  contacted: 2,
  qualified: 2,
  matched: 3,
  closed_won: 4,
  closed_lost: 0, // handled separately
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "trackStatus" });
  return { title: t("metaTitle"), robots: { index: false, follow: false } };
}

export default async function TrackStatusPage({
  params,
}: {
  params: Promise<{ locale: Locale; token: string }>;
}) {
  const { locale, token } = await params;
  setRequestLocale(locale);
  if (!UUID_RE.test(token)) notFound();

  const [row] = await db
    .select({ lead: leads, assigneeName: users.name })
    .from(leads)
    .leftJoin(users, eq(leads.assignedTo, users.id))
    .where(eq(leads.trackingToken, token))
    .limit(1);
  if (!row) notFound();
  const { lead, assigneeName } = row;

  const t = await getTranslations("trackStatus");
  const tl = await getTranslations("track");
  const isClosed = lead.status === "closed_lost";
  const currentStep = STATUS_STEP[lead.status] ?? 1;

  const fmt = (d: Date) =>
    new Intl.DateTimeFormat(locale === "ar" ? "ar-AE" : "en-AE", {
      day: "numeric",
      month: "long",
      year: "numeric",
    }).format(d);

  const steps = [
    { key: "received" as const, num: 1 },
    { key: "review" as const, num: 2 },
    { key: "matched" as const, num: 3 },
    { key: "completed" as const, num: 4 },
  ];

  return (
    <div className="mx-auto max-w-2xl px-4 py-14 sm:px-6">
      <FadeIn>
        <p className="text-center text-xs font-semibold uppercase tracking-wide text-brand-700">
          {t("title")}
        </p>
        <h1 className="mt-2 text-center text-3xl font-extrabold tracking-tight text-ink-900">
          {t("hello", { company: lead.companyName })}
        </h1>
        <div className="mt-3 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-sm text-ink-500">
          <span>{t("submittedOn", { date: fmt(lead.createdAt) })}</span>
          <span aria-hidden>·</span>
          <span>{t("lastUpdate", { date: fmt(lead.updatedAt) })}</span>
        </div>
        <p className="mt-2 text-center text-sm font-medium text-ink-600">
          {assigneeName
            ? t("specialist", { name: assigneeName })
            : t("specialistUnassigned")}
        </p>
      </FadeIn>

      {isClosed ? (
        <FadeIn>
          <div className="mt-10 rounded-3xl border border-ink-100 bg-ink-50 p-8 text-center">
            <p className="leading-relaxed text-ink-700">{t("closedNote")}</p>
            <Link
              href="/get-matched"
              className="press btn-shine hover-lift mt-6 inline-block rounded-xl bg-brand-700 px-6 py-3 font-semibold text-white hover:bg-brand-800"
            >
              {tl("newRequest")}
            </Link>
          </div>
        </FadeIn>
      ) : (
        <StaggerGroup className="mt-10">
          <ol className="relative space-y-0">
            {steps.map((step, i) => {
              const state =
                step.num < currentStep
                  ? "done"
                  : step.num === currentStep
                    ? "current"
                    : "todo";
              return (
                <StaggerItem key={step.key}>
                  <li className="relative flex gap-4 pb-8 last:pb-0">
                    {i < steps.length - 1 && (
                      <span
                        aria-hidden
                        className={`absolute start-[19px] top-10 h-[calc(100%-2.5rem)] w-0.5 rounded ${
                          state === "done" ? "bg-brand-500" : "bg-ink-200"
                        }`}
                      />
                    )}
                    <span
                      aria-hidden
                      className={`relative z-10 grid size-10 shrink-0 place-items-center rounded-full text-sm font-bold ring-4 ring-white ${
                        state === "done"
                          ? "bg-brand-600 text-white"
                          : state === "current"
                            ? "bg-accent-500 text-ink-950 shadow-lg shadow-accent-500/30"
                            : "bg-ink-100 text-ink-400"
                      }`}
                    >
                      {state === "done" ? (
                        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                          <path d="M3 8.5L6.5 12L13 4.5" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      ) : (
                        step.num
                      )}
                    </span>
                    <div className={`pt-1.5 ${state === "todo" ? "opacity-50" : ""}`}>
                      <p className="font-bold text-ink-900">
                        {t(`steps.${step.key}.label` as Parameters<typeof t>[0])}
                        {state === "current" && (
                          <span className="ms-2 inline-block size-2 animate-pulse-soft rounded-full bg-accent-500 align-middle" aria-hidden />
                        )}
                      </p>
                      <p className="mt-1 text-sm leading-relaxed text-ink-600">
                        {t(`steps.${step.key}.body` as Parameters<typeof t>[0])}
                      </p>
                    </div>
                  </li>
                </StaggerItem>
              );
            })}
          </ol>
        </StaggerGroup>
      )}

      <FadeIn>
        <div className="mt-10 space-y-2 rounded-2xl bg-brand-50 p-5 text-center">
          <p className="text-sm font-semibold text-brand-900">{t("keepLink")}</p>
          <p className="text-xs text-brand-800/70">{t("questions")}</p>
        </div>
      </FadeIn>
    </div>
  );
}
