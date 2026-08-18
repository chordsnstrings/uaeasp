import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { OutreachAnalytics, ShortlistRequest } from "@/components/outreach/ShortlistRequest";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { outreachThreads, prospects } from "@/db/schema";
import { getPublicProviders, getActiveProviderCount } from "@/lib/data";
import {
  MANDATE_PHASES,
  appointmentDeadlineFor,
  formatMandateDate,
} from "@/content/mandate";
import { EMIRATE_LABELS } from "@/components/admin/status";

export const dynamic = "force-dynamic";

/**
 * The page an outreach email links to.
 *
 * A cold email cannot carry a whole argument, so it carries one line and a
 * link, and this page does the rest — already knowing who is reading it. That
 * is the difference between "here is our directory" and "here is what applies
 * to you, and here is the date you are working to".
 *
 * The urgency on this page is real: the deadline is the Ministry's, rendered
 * from the same MANDATE_PHASES the rest of the site uses. No invented scarcity,
 * no fake counters — a genuine date, counted honestly, is more persuasive than
 * anything fabricated and does not fall apart when someone checks it.
 */

export const metadata: Metadata = {
  // Per-recipient pages must never be indexed, and must never leak into a
  // referrer header on the way out.
  robots: { index: false, follow: false, nocache: true },
  referrer: "no-referrer",
};

function daysUntil(iso: string): number {
  return Math.ceil((new Date(iso).getTime() - Date.now()) / 86_400_000);
}

export default async function OutreachLandingPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(token)) notFound();

  const [thread] = await db
    .select()
    .from(outreachThreads)
    .where(eq(outreachThreads.token, token))
    .limit(1);
  if (!thread) notFound();

  const [prospect] = thread.prospectId
    ? await db.select().from(prospects).where(eq(prospects.id, thread.prospectId)).limit(1)
    : [];

  const [providers, count] = await Promise.all([
    getPublicProviders(),
    getActiveProviderCount(),
  ]);
  const active = providers.filter((p) => p.status === "active");

  const phase = prospect?.mandateWave === "phase-1" ? "large" : "other";
  const phaseInfo = MANDATE_PHASES.find((p) => p.key === phase)!;
  const appointBy = appointmentDeadlineFor(prospect?.mandateWave);
  const daysLeft = daysUntil(phaseInfo.appointDeadlineIso);
  const company = prospect?.name ?? "your business";

  // Providers that actually serve their emirate come first — a shortlist that
  // ignores where they are is not a shortlist.
  const local = prospect?.emirate
    ? active.filter((p) => p.emirates?.includes(prospect.emirate as string))
    : [];
  const shortlist = (local.length >= 3 ? local : active).slice(0, 3);

  return (
    <main className="mx-auto max-w-3xl px-4 py-12 sm:px-6 sm:py-16">
      <OutreachAnalytics />
      <p className="stamp text-[11px] uppercase tracking-[0.12em] text-brand-700">
        Prepared for {company}
      </p>
      <h1 className="font-display mt-3 text-3xl font-medium tracking-tight text-ink-900 sm:text-4xl">
        {daysLeft > 0 ? (
          <>
            You have <span className="num">{daysLeft}</span> days to appoint an accredited
            e-invoicing provider
          </>
        ) : (
          <>The deadline to appoint an accredited e-invoicing provider has passed</>
        )}
      </h1>

      <div className="mt-6 rounded-2xl border border-ink-200 bg-paper-dark p-5">
        <dl className="grid gap-4 sm:grid-cols-3">
          <div>
            <dt className="text-[11px] font-medium uppercase tracking-[0.08em] text-ink-500">
              Appoint a provider by
            </dt>
            <dd className="num mt-1 text-lg font-medium text-ink-900">{appointBy}</dd>
          </div>
          <div>
            <dt className="text-[11px] font-medium uppercase tracking-[0.08em] text-ink-500">
              Invoices must flow from
            </dt>
            <dd className="num mt-1 text-lg font-medium text-ink-900">
              {formatMandateDate(phaseInfo.goLiveIso, "en")}
            </dd>
          </div>
          <div>
            <dt className="text-[11px] font-medium uppercase tracking-[0.08em] text-ink-500">
              Accredited providers
            </dt>
            <dd className="num mt-1 text-lg font-medium text-ink-900">{count}</dd>
          </div>
        </dl>
        <p className="mt-4 text-sm leading-relaxed text-ink-600">
          These are the Ministry of Finance&rsquo;s dates, not ours.{" "}
          {prospect?.emirate && (
            <>
              {company} is registered in{" "}
              {EMIRATE_LABELS[prospect.emirate] ?? prospect.emirate}, and the same national
              timeline applies there.{" "}
            </>
          )}
          Once the deadline passes, invoices issued outside the system carry administrative
          penalties.
        </p>
      </div>

      <section className="mt-10">
        <h2 className="font-display text-xl font-medium tracking-tight text-ink-900">
          Three to start with
        </h2>
        <p className="mt-1 text-sm text-ink-600">
          {local.length >= 3
            ? `Accredited providers that serve ${EMIRATE_LABELS[prospect?.emirate ?? ""] ?? "your emirate"}.`
            : "Accredited providers from the official list."}{" "}
          We take no payment from any of them, and this is not a ranking — tell us your
          volume and system and we will narrow it properly.
        </p>
        <ul className="mt-5 space-y-3">
          {shortlist.map((p) => (
            <li key={p.id} className="rounded-xl border border-ink-200 bg-white p-4">
              <p className="font-medium text-ink-900">{p.name}</p>
              {p.description && (
                <p className="mt-1 line-clamp-2 text-sm text-ink-600">{p.description}</p>
              )}
              <Link
                href={`/providers/${p.slug}`}
                className="mt-2 inline-block text-sm font-medium text-brand-700 hover:text-brand-900"
              >
                See the full profile →
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-10 rounded-2xl border border-brand-200 bg-brand-50/50 p-6">
        <h2 className="font-display text-xl font-medium tracking-tight text-ink-900">
          Get a shortlist built for {company}
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-ink-700">
          Tell us your monthly invoice volume and the accounting system you already run. We
          will send back the three accredited providers that fit, with what each would need
          from you. Free, and we are not a provider.
        </p>
        {/* The ask lives here rather than behind a link. Sending someone who
            has already clicked an email to another page and an eleven-field
            form is how thirty-six visits produced no leads. */}
        <div className="mt-5">
          <ShortlistRequest token={token} company={company} />
        </div>
        <p className="mt-4 text-sm text-ink-500">
          Or{" "}
          <Link href="/providers" className="font-medium text-brand-700 underline">
            browse all {count} providers
          </Link>{" "}
          yourself — the full list is free and needs no details.
        </p>
      </section>

      <p className="mt-8 text-xs leading-relaxed text-ink-400">
        You received this because we contacted {company} about the UAE e-invoicing mandate.
        We are an independent directory, not the Ministry of Finance, the FTA, or a provider.
      </p>
    </main>
  );
}
