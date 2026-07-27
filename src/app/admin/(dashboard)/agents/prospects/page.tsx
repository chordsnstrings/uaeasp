import Link from "next/link";
import { redirect } from "next/navigation";
import { desc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { outreachThreads, prospectContacts, prospects } from "@/db/schema";
import { auth } from "@/lib/auth";
import { SuppressForm } from "@/components/admin/AgentConsole";

export const dynamic = "force-dynamic";

export default async function ProspectsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const session = await auth();
  if (session?.user?.role !== "admin") redirect("/admin");
  const { status } = await searchParams;

  const rows = await db
    .select({
      prospect: prospects,
      contacts: sql<string>`(SELECT count(*) FROM prospect_contacts pc WHERE pc.prospect_id = ${prospects.id})`,
      threadStatus: outreachThreads.status,
    })
    .from(prospects)
    .leftJoin(outreachThreads, eq(outreachThreads.prospectId, prospects.id))
    .where(status ? eq(prospects.status, status as "discovered") : sql`true`)
    .orderBy(desc(prospects.createdAt))
    .limit(100);

  const counts = await db
    .select({ status: prospects.status, n: sql<string>`count(*)` })
    .from(prospects)
    .groupBy(prospects.status);

  return (
    <div className="space-y-6">
      <header>
        <Link href="/admin/agents" className="text-xs font-semibold text-brand-700 hover:text-brand-900">
          ← Agents
        </Link>
        <h1 className="mt-2 text-2xl font-bold text-ink-900">Prospects</h1>
        <p className="mt-1 max-w-2xl text-sm text-ink-500">
          Businesses the Prospector found, with the fit score and reason it recorded. Anything
          scored below your threshold waits here instead of being emailed.
        </p>
      </header>

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
        <table className="w-full text-sm">
          <thead className="border-b border-ink-200 bg-paper-dark">
            <tr className="num text-[10px] uppercase tracking-[0.1em] text-ink-500">
              <th className="px-4 py-2.5 text-start">Business</th>
              <th className="px-4 py-2.5 text-start">Emirate</th>
              <th className="px-4 py-2.5 text-start">Sector</th>
              <th className="px-4 py-2.5 text-end">Score</th>
              <th className="px-4 py-2.5 text-end">Contacts</th>
              <th className="px-4 py-2.5 text-start">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-ink-100">
            {rows.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-ink-500">
                  No prospects yet. Turn on the Prospector and run a discovery sweep.
                </td>
              </tr>
            )}
            {rows.map(({ prospect, contacts, threadStatus }) => (
              <tr key={prospect.id}>
                <td className="px-4 py-3">
                  <p className="font-medium text-ink-900">{prospect.name}</p>
                  {prospect.website && (
                    <a
                      href={prospect.website}
                      target="_blank"
                      rel="noreferrer nofollow"
                      className="num text-xs text-ink-400 hover:text-brand-700"
                      dir="ltr"
                    >
                      {prospect.domain}
                    </a>
                  )}
                  {prospect.scoreReason && (
                    <p className="mt-1 text-xs text-ink-500">{prospect.scoreReason}</p>
                  )}
                </td>
                <td className="px-4 py-3 text-xs text-ink-600">{prospect.emirate ?? "—"}</td>
                <td className="px-4 py-3 text-xs text-ink-600">{prospect.sector ?? "—"}</td>
                <td className="num px-4 py-3 text-end font-semibold text-ink-900">
                  {prospect.score ?? "—"}
                </td>
                <td className="num px-4 py-3 text-end text-ink-600">{contacts}</td>
                <td className="px-4 py-3">
                  <span className="num rounded bg-ink-100 px-1.5 py-0.5 text-[10px] uppercase text-ink-600">
                    {threadStatus ?? prospect.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="rounded-xl border border-ink-200 bg-white p-5">
        <SuppressForm />
      </div>
    </div>
  );
}
