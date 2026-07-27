import Link from "next/link";
import { redirect } from "next/navigation";
import { asc, desc, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/db";
import { outreachThreads, prospectContacts, prospects, suppressions } from "@/db/schema";
import { auth } from "@/lib/auth";
import { getAgentConfig } from "@/lib/agents/config";
import { SuppressForm } from "@/components/admin/AgentConsole";

export const dynamic = "force-dynamic";

const VERIFICATION_LABEL: Record<string, string> = {
  mx_ok: "MX verified",
  syntax_ok: "syntax only",
  unknown: "unchecked",
  risky: "risky",
  invalid: "invalid",
};

export default async function ProspectsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const session = await auth();
  if (session?.user?.role !== "admin") redirect("/admin");
  const { status } = await searchParams;
  const config = await getAgentConfig();

  const rows = await db
    .select({
      prospect: prospects,
      threadStatus: outreachThreads.status,
    })
    .from(prospects)
    .leftJoin(outreachThreads, eq(outreachThreads.prospectId, prospects.id))
    .where(status ? eq(prospects.status, status as "discovered") : sql`true`)
    .orderBy(desc(prospects.score), desc(prospects.createdAt))
    .limit(100);

  // Every address for the prospects on screen, in the same priority order the
  // Conversationalist uses — so the first one listed is genuinely the one that
  // would be mailed, not a guess.
  const ids = rows.map((r) => r.prospect.id);
  const contacts = ids.length
    ? await db
        .select()
        .from(prospectContacts)
        .where(inArray(prospectContacts.prospectId, ids))
        .orderBy(asc(prospectContacts.priority))
    : [];
  const byProspect = new Map<string, typeof contacts>();
  for (const c of contacts) {
    const list = byProspect.get(c.prospectId) ?? [];
    list.push(c);
    byProspect.set(c.prospectId, list);
  }

  const blocked = new Set(
    contacts.length
      ? (
          await db
            .select({ email: suppressions.email })
            .from(suppressions)
            .where(inArray(suppressions.email, [...new Set(contacts.map((c) => c.email))]))
        ).map((s) => s.email)
      : [],
  );

  const counts = await db
    .select({ status: prospects.status, n: sql<string>`count(*)` })
    .from(prospects)
    .groupBy(prospects.status);

  const contactableCount = Number(counts.find((c) => c.status === "contactable")?.n ?? 0);
  const sequencedCount = Number(counts.find((c) => c.status === "sequenced")?.n ?? 0);

  return (
    <div className="space-y-6">
      <header>
        <Link
          href="/admin/agents"
          className="text-xs font-semibold text-brand-700 hover:text-brand-900"
        >
          ← Agents
        </Link>
        <h1 className="mt-2 text-2xl font-bold text-ink-900">Prospects</h1>
        <p className="mt-1 max-w-2xl text-sm text-ink-500">
          Every business the Prospector found, the exact address it would write to, and why it
          did or did not qualify. Anything scoring under {config.prospectorMinScore} waits here
          instead of being emailed.
        </p>
      </header>

      <div className="rounded-xl border border-ink-200 bg-white p-5">
        <p className="text-sm text-ink-600">
          <span className="num text-2xl font-bold text-ink-900">{contactableCount}</span>{" "}
          {contactableCount === 1 ? "business is" : "businesses are"} cleared to be contacted
          {sequencedCount > 0 && <> · {sequencedCount} already in a sequence</>}.
        </p>
        <p className="mt-1 text-xs text-ink-500">
          Approval mode is <strong>{config.outreachApprovalMode}</strong>
          {config.outreachApprovalMode === "manual" && (
            <> — nothing leaves without you approving it in Approvals</>
          )}
          . Daily cap {config.outreachDailyCap}, starting at {config.outreachWarmupStartCap}/day.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <Link
          href="/admin/agents/prospects"
          className={`num rounded-full px-3 py-1 text-xs ring-1 ${
            !status ? "bg-ink-900 text-white ring-ink-900" : "bg-white text-ink-600 ring-ink-200"
          }`}
        >
          all
        </Link>
        {counts.map((c) => (
          <Link
            key={c.status}
            href={`/admin/agents/prospects?status=${c.status}`}
            className={`num rounded-full px-3 py-1 text-xs ring-1 ${
              status === c.status
                ? "bg-ink-900 text-white ring-ink-900"
                : "bg-white text-ink-600 ring-ink-200"
            }`}
          >
            {c.status} {c.n}
          </Link>
        ))}
      </div>

      <div className="overflow-x-auto rounded-xl border border-ink-200 bg-white">
        <table className="w-full min-w-[56rem] text-sm">
          <thead className="border-b border-ink-200 bg-paper-dark">
            <tr className="num text-[10px] uppercase tracking-[0.1em] text-ink-500">
              <th className="px-4 py-2.5 text-start">Business</th>
              <th className="px-4 py-2.5 text-start">Will be contacted at</th>
              <th className="px-4 py-2.5 text-start">Emirate</th>
              <th className="px-4 py-2.5 text-end">Score</th>
              <th className="px-4 py-2.5 text-start">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-ink-100">
            {rows.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-ink-500">
                  No prospects yet. Turn on the Prospector and run a discovery sweep.
                </td>
              </tr>
            )}
            {rows.map(({ prospect, threadStatus }) => {
              const list = byProspect.get(prospect.id) ?? [];
              const primary = list[0];
              const alternates = list.length - 1;
              const suppressed = primary ? blocked.has(primary.email) : false;
              return (
                <tr key={prospect.id} className="align-top">
                  <td className="min-w-0 px-4 py-3">
                    <Link
                      href={`/admin/agents/prospects/${prospect.id}`}
                      className="font-medium text-ink-900 underline-offset-2 hover:text-brand-700 hover:underline"
                    >
                      {prospect.name}
                    </Link>
                    {prospect.domain && (
                      <p className="num text-xs text-ink-400" dir="ltr">
                        {prospect.domain}
                      </p>
                    )}
                    {prospect.scoreReason && (
                      <p className="mt-1 max-w-md break-words text-xs text-ink-500">
                        {prospect.scoreReason}
                      </p>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {primary ? (
                      <>
                        <p
                          className={`num break-all text-xs ${
                            suppressed ? "text-ink-400 line-through" : "text-ink-900"
                          }`}
                          dir="ltr"
                        >
                          {primary.email}
                        </p>
                        <p className="mt-0.5 text-[11px] text-ink-500">
                          {VERIFICATION_LABEL[primary.verification] ?? primary.verification}
                          {primary.isRoleAccount && " · shared mailbox"}
                          {suppressed && " · suppressed, will not be mailed"}
                        </p>
                        {alternates > 0 && (
                          <p className="text-[11px] text-ink-400">
                            +{alternates} other {alternates === 1 ? "address" : "addresses"} on file
                          </p>
                        )}
                      </>
                    ) : (
                      <span className="text-xs text-ink-400">no address found</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs text-ink-600">{prospect.emirate ?? "—"}</td>
                  <td className="num px-4 py-3 text-end font-semibold text-ink-900">
                    {prospect.score ?? "—"}
                  </td>
                  <td className="px-4 py-3">
                    <span className="num rounded bg-ink-100 px-1.5 py-0.5 text-[10px] uppercase text-ink-600">
                      {threadStatus ?? prospect.status}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="rounded-xl border border-ink-200 bg-white p-5">
        <SuppressForm />
      </div>
    </div>
  );
}
