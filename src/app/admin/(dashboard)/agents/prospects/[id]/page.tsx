import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { asc, desc, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import {
  outreachMessages,
  outreachThreads,
  prospectContacts,
  prospects,
  suppressions,
} from "@/db/schema";
import { auth } from "@/lib/auth";
import { getAgentConfig } from "@/lib/agents/config";

export const dynamic = "force-dynamic";

const VERIFICATION_LABEL: Record<string, string> = {
  mx_ok: "MX verified",
  syntax_ok: "syntax only",
  unknown: "unchecked",
  risky: "risky",
  invalid: "invalid",
};

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="num text-[10px] uppercase tracking-[0.1em] text-ink-500">{label}</dt>
      <dd className="mt-0.5 break-words text-sm text-ink-900">{children}</dd>
    </div>
  );
}

export default async function ProspectDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (session?.user?.role !== "admin") redirect("/admin");
  const { id } = await params;
  const config = await getAgentConfig();

  const [prospect] = await db.select().from(prospects).where(eq(prospects.id, id)).limit(1);
  if (!prospect) notFound();

  const contacts = await db
    .select()
    .from(prospectContacts)
    .where(eq(prospectContacts.prospectId, id))
    .orderBy(asc(prospectContacts.priority));

  const blocked = new Set(
    contacts.length
      ? (
          await db
            .select({ email: suppressions.email })
            .from(suppressions)
            .where(inArray(suppressions.email, contacts.map((c) => c.email)))
        ).map((s) => s.email)
      : [],
  );

  const threads = await db
    .select()
    .from(outreachThreads)
    .where(eq(outreachThreads.prospectId, id))
    .orderBy(desc(outreachThreads.createdAt));

  const messages = threads.length
    ? await db
        .select()
        .from(outreachMessages)
        .where(inArray(outreachMessages.threadId, threads.map((t) => t.id)))
        .orderBy(asc(outreachMessages.createdAt))
    : [];

  const primary = contacts[0];
  const raw = prospect.raw as { types?: string[]; reviewCount?: number; rating?: number } | null;

  return (
    <div className="space-y-6">
      <header>
        <Link
          href="/admin/agents/prospects"
          className="text-xs font-semibold text-brand-700 hover:text-brand-900"
        >
          ← Prospects
        </Link>
        <h1 className="mt-2 break-words text-2xl font-bold text-ink-900">{prospect.name}</h1>
        {prospect.website && (
          <a
            href={prospect.website}
            target="_blank"
            rel="noreferrer nofollow"
            className="num break-all text-xs text-ink-400 hover:text-brand-700"
            dir="ltr"
          >
            {prospect.website}
          </a>
        )}
      </header>

      <section className="rounded-xl border border-ink-200 bg-white p-5">
        <h2 className="text-sm font-semibold text-ink-900">What happens next</h2>
        {prospect.status === "contactable" && primary && !blocked.has(primary.email) && (
          <p className="mt-1 text-sm text-ink-600">
            Cleared to contact. The first message would go to{" "}
            <span className="num font-medium text-ink-900" dir="ltr">
              {primary.email}
            </span>
            {config.outreachApprovalMode === "manual"
              ? " once you approve it in Approvals."
              : " automatically on the next send window."}
          </p>
        )}
        {prospect.status === "enriched" && (
          <p className="mt-1 text-sm text-ink-600">
            Held. It has a usable address but scored{" "}
            <span className="num">{prospect.score ?? "n/a"}</span>, under your threshold of{" "}
            <span className="num">{config.prospectorMinScore}</span>. Nothing will be sent.
          </p>
        )}
        {prospect.status === "rejected" && (
          <p className="mt-1 text-sm text-ink-600">
            Rejected — {prospect.scoreReason ?? "no usable address was found on the site"}. Nothing
            will be sent.
          </p>
        )}
        {prospect.status === "suppressed" && (
          <p className="mt-1 text-sm text-ink-600">
            Suppressed. This address opted out, bounced or was blocked by hand, and is permanently
            excluded.
          </p>
        )}
        {prospect.status === "discovered" && (
          <p className="mt-1 text-sm text-ink-600">
            Found but not yet crawled or scored. It will be enriched on an upcoming run.
          </p>
        )}
        {["sequenced", "replied", "converted"].includes(prospect.status) && (
          <p className="mt-1 text-sm text-ink-600">
            Already in conversation — see the thread below.
          </p>
        )}
      </section>

      <section className="rounded-xl border border-ink-200 bg-white p-5">
        <h2 className="mb-3 text-sm font-semibold text-ink-900">Business</h2>
        <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="Emirate">{prospect.emirate ?? "—"}</Field>
          <Field label="Sector searched">{prospect.sector ?? "—"}</Field>
          <Field label="Size hint">{prospect.sizeHint ?? "—"}</Field>
          <Field label="Mandate wave">{prospect.mandateWave ?? "—"}</Field>
          <Field label="Phone">
            <span className="num" dir="ltr">
              {prospect.phone ?? "—"}
            </span>
          </Field>
          <Field label="Source">{prospect.source}</Field>
          <Field label="Address">{prospect.address ?? "—"}</Field>
          <Field label="Google types">{raw?.types?.join(", ") ?? "—"}</Field>
          <Field label="Reviews">
            <span className="num">
              {raw?.reviewCount ?? "—"}
              {raw?.rating ? ` · ${raw.rating}★` : ""}
            </span>
          </Field>
        </dl>
      </section>

      <section className="rounded-xl border border-ink-200 bg-white p-5">
        <h2 className="text-sm font-semibold text-ink-900">
          Fit score{" "}
          <span className="num ml-1 text-lg font-bold">{prospect.score ?? "—"}</span>
          <span className="num text-xs font-normal text-ink-500">
            {" "}
            / threshold {config.prospectorMinScore}
          </span>
        </h2>
        <p className="mt-1 text-sm text-ink-600">
          {prospect.scoreReason ?? "No reason recorded."}
        </p>
      </section>

      <section className="rounded-xl border border-ink-200 bg-white">
        <div className="border-b border-ink-200 px-5 py-4">
          <h2 className="text-sm font-semibold text-ink-900">
            Addresses found ({contacts.length})
          </h2>
          <p className="mt-1 text-xs text-ink-500">
            In send order. Only the top one is used; the rest are fallbacks if it bounces. Every
            address was taken from a public page on the business&rsquo;s own site.
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[44rem] text-sm">
            <thead className="bg-paper-dark">
              <tr className="num text-[10px] uppercase tracking-[0.1em] text-ink-500">
                <th className="px-4 py-2.5 text-start">Address</th>
                <th className="px-4 py-2.5 text-start">Verification</th>
                <th className="px-4 py-2.5 text-start">Found on</th>
                <th className="px-4 py-2.5 text-end">Priority</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-100">
              {contacts.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-ink-500">
                    No address was found on this site, so it can never be contacted.
                  </td>
                </tr>
              )}
              {contacts.map((c, i) => {
                const isBlocked = blocked.has(c.email);
                return (
                  <tr key={c.id} className="align-top">
                    <td className="px-4 py-3">
                      <p
                        className={`num break-all ${
                          isBlocked ? "text-ink-400 line-through" : "text-ink-900"
                        }`}
                        dir="ltr"
                      >
                        {c.email}
                      </p>
                      <p className="text-[11px] text-ink-500">
                        {i === 0 && !isBlocked && "primary · "}
                        {c.name ?? c.role ?? (c.isRoleAccount ? "shared mailbox" : "personal")}
                        {isBlocked && " · suppressed"}
                      </p>
                    </td>
                    <td className="px-4 py-3 text-xs text-ink-600">
                      {VERIFICATION_LABEL[c.verification] ?? c.verification}
                    </td>
                    <td className="px-4 py-3">
                      {c.sourceUrl ? (
                        <a
                          href={c.sourceUrl}
                          target="_blank"
                          rel="noreferrer nofollow"
                          className="num break-all text-xs text-ink-500 hover:text-brand-700"
                          dir="ltr"
                        >
                          {c.sourceUrl}
                        </a>
                      ) : (
                        <span className="text-xs text-ink-400">—</span>
                      )}
                    </td>
                    <td className="num px-4 py-3 text-end text-xs text-ink-600">{c.priority}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {threads.length > 0 && (
        <section className="rounded-xl border border-ink-200 bg-white p-5">
          <h2 className="text-sm font-semibold text-ink-900">Conversation</h2>
          {threads.map((t) => (
            <div key={t.id} className="mt-3 border-t border-ink-100 pt-3 first:border-0 first:pt-0">
              <p className="text-xs text-ink-500">
                <span className="num rounded bg-ink-100 px-1.5 py-0.5 text-[10px] uppercase text-ink-600">
                  {t.status}
                </span>{" "}
                <span className="num" dir="ltr">
                  {t.toEmail}
                </span>{" "}
                · step {t.stepIndex}
              </p>
              <ul className="mt-2 space-y-2">
                {messages
                  .filter((m) => m.threadId === t.id)
                  .map((m) => (
                    <li key={m.id} className="rounded-lg bg-paper-dark p-3">
                      <p className="num text-[10px] uppercase tracking-[0.1em] text-ink-500">
                        {m.direction} · {m.status}
                        {m.sentAt && ` · ${m.sentAt.toISOString().slice(0, 16).replace("T", " ")}`}
                      </p>
                      {m.subject && (
                        <p className="mt-1 text-sm font-medium text-ink-900">{m.subject}</p>
                      )}
                      <p className="mt-1 whitespace-pre-wrap text-xs text-ink-600">
                        {m.bodyText?.slice(0, 1200)}
                      </p>
                    </li>
                  ))}
              </ul>
            </div>
          ))}
        </section>
      )}
    </div>
  );
}
