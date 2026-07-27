import Link from "next/link";
import { redirect } from "next/navigation";
import { and, asc, desc, eq, ilike, inArray, or, sql, type SQL } from "drizzle-orm";
import { db } from "@/db";
import { PROSPECT_STATUSES, prospectContacts, prospects, suppressions } from "@/db/schema";
import { auth } from "@/lib/auth";
import { getAgentConfig } from "@/lib/agents/config";
import { EMIRATE_LABELS } from "@/components/admin/status";
import { SuppressForm } from "@/components/admin/AgentConsole";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 25;

const VERIFICATION_LABEL: Record<string, string> = {
  mx_ok: "MX verified",
  syntax_ok: "syntax only",
  unknown: "unchecked",
  risky: "risky",
  invalid: "invalid",
};

type ProspectStatus = (typeof PROSPECT_STATUSES)[number];

export default async function ProspectsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const session = await auth();
  if (session?.user?.role !== "admin") redirect("/admin");
  const params = await searchParams;
  const config = await getAgentConfig();

  const status = params.status as ProspectStatus | undefined;
  const emirate = params.emirate;
  const sector = params.sector?.trim();
  const contactable = params.contactable;
  const q = params.q?.trim();
  const sort = params.sort === "newest" ? "newest" : "score";
  const page = Math.max(1, Number(params.page ?? 1) || 1);

  const conditions: SQL[] = [];
  if (status && PROSPECT_STATUSES.includes(status)) {
    conditions.push(eq(prospects.status, status));
  }
  if (emirate && EMIRATE_LABELS[emirate]) conditions.push(eq(prospects.emirate, emirate));
  if (sector) conditions.push(eq(prospects.sector, sector));

  // "Has a usable address" is the question that actually decides whether a
  // business can ever be written to, so it deserves its own filter rather than
  // being inferred from the status chips.
  const hasContact = sql`EXISTS (SELECT 1 FROM prospect_contacts pc WHERE pc.prospect_id = ${prospects.id})`;
  if (contactable === "yes") conditions.push(hasContact);
  else if (contactable === "no") conditions.push(sql`NOT ${hasContact}`);

  if (q) {
    const pattern = `%${q}%`;
    conditions.push(
      or(
        ilike(prospects.name, pattern),
        ilike(prospects.domain, pattern),
        // Searching the address is the point of the screen — being able to ask
        // "are we about to mail this person?" and get a straight answer.
        sql`EXISTS (SELECT 1 FROM prospect_contacts pc WHERE pc.prospect_id = ${prospects.id} AND pc.email ILIKE ${pattern})`,
      )!,
    );
  }
  const where = conditions.length ? and(...conditions) : undefined;

  const orderBy =
    sort === "newest"
      ? [desc(prospects.createdAt)]
      : [sql`${prospects.score} DESC NULLS LAST`, desc(prospects.createdAt)];

  const [rows, countRow, counts, sectorRows] = await Promise.all([
    db
      .select({
        prospect: prospects,
        // A prospect can own more than one thread, and joining them would
        // duplicate rows and corrupt both the page size and the total. Take
        // the latest thread's status as a scalar instead.
        threadStatus: sql<
          string | null
        >`(SELECT t.status FROM outreach_threads t WHERE t.prospect_id = ${prospects.id} ORDER BY t.created_at DESC LIMIT 1)`,
      })
      .from(prospects)
      .where(where)
      .orderBy(...orderBy)
      .limit(PAGE_SIZE)
      .offset((page - 1) * PAGE_SIZE),
    db.select({ count: sql<number>`count(*)::int` }).from(prospects).where(where),
    db
      .select({ status: prospects.status, n: sql<number>`count(*)::int` })
      .from(prospects)
      .groupBy(prospects.status),
    db
      .selectDistinct({ sector: prospects.sector })
      .from(prospects)
      .where(sql`${prospects.sector} is not null`)
      .orderBy(asc(prospects.sector)),
  ]);

  const totalCount = countRow[0]?.count ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

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

  const filterHref = (patch: Record<string, string | undefined>) => {
    const next = new URLSearchParams();
    const merged = { status, emirate, sector, contactable, q, sort, page: undefined, ...patch };
    for (const [key, value] of Object.entries(merged)) {
      if (value && !(key === "sort" && value === "score")) next.set(key, String(value));
    }
    const qs = next.toString();
    return `/admin/agents/prospects${qs ? `?${qs}` : ""}`;
  };

  const contactableCount = counts.find((c) => c.status === "contactable")?.n ?? 0;
  const sequencedCount = counts.find((c) => c.status === "sequenced")?.n ?? 0;
  const filtered = Boolean(status || emirate || sector || contactable || q);

  return (
    <div className="space-y-6">
      <header>
        <Link
          href="/admin/agents"
          className="text-xs font-semibold text-brand-700 hover:text-brand-900"
        >
          ← Agents
        </Link>
        <h1 className="mt-2 text-2xl font-bold text-ink-900">
          Prospects <span className="text-base font-medium text-ink-400">({totalCount})</span>
        </h1>
        <p className="mt-1 max-w-2xl text-sm text-ink-500">
          Every business the Prospector found, the exact address it would write to, and why it did
          or did not qualify. Anything scoring under {config.prospectorMinScore} waits here instead
          of being emailed.
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

      <div className="flex flex-wrap items-center gap-2">
        <Link
          href={filterHref({ status: undefined })}
          className={`press num rounded-full px-3.5 py-1.5 text-xs font-semibold ring-1 ${
            !status
              ? "bg-ink-900 text-white ring-ink-900"
              : "bg-white text-ink-600 ring-ink-200 hover:ring-ink-400"
          }`}
        >
          all
        </Link>
        {PROSPECT_STATUSES.map((s) => {
          const n = counts.find((c) => c.status === s)?.n ?? 0;
          if (!n && status !== s) return null;
          return (
            <Link
              key={s}
              href={filterHref({ status: s })}
              className={`press num rounded-full px-3.5 py-1.5 text-xs font-semibold ring-1 ${
                status === s
                  ? "bg-ink-900 text-white ring-ink-900"
                  : "bg-white text-ink-600 ring-ink-200 hover:ring-ink-400"
              }`}
            >
              {s} {n}
            </Link>
          );
        })}
      </div>

      <form method="get" className="flex flex-wrap gap-2">
        {status && <input type="hidden" name="status" value={status} />}
        <input
          type="search"
          name="q"
          defaultValue={q ?? ""}
          placeholder="Search business, domain or email…"
          className="w-full max-w-xs rounded-xl border border-ink-200 bg-white px-4 py-2.5 text-sm focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
        />
        <select
          name="emirate"
          defaultValue={emirate ?? ""}
          className="rounded-xl border border-ink-200 bg-white px-3 py-2.5 text-sm focus:border-brand-400"
        >
          <option value="">All emirates</option>
          {Object.entries(EMIRATE_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        <select
          name="sector"
          defaultValue={sector ?? ""}
          className="rounded-xl border border-ink-200 bg-white px-3 py-2.5 text-sm focus:border-brand-400"
        >
          <option value="">All sectors</option>
          {sectorRows.map((s) => (
            <option key={s.sector} value={s.sector ?? ""}>
              {s.sector}
            </option>
          ))}
        </select>
        <select
          name="contactable"
          defaultValue={contactable ?? ""}
          className="rounded-xl border border-ink-200 bg-white px-3 py-2.5 text-sm focus:border-brand-400"
        >
          <option value="">Any address</option>
          <option value="yes">Has an address</option>
          <option value="no">No address found</option>
        </select>
        <select
          name="sort"
          defaultValue={sort}
          className="rounded-xl border border-ink-200 bg-white px-3 py-2.5 text-sm focus:border-brand-400"
        >
          <option value="score">Highest score</option>
          <option value="newest">Newest first</option>
        </select>
        <button
          type="submit"
          className="press rounded-xl bg-ink-900 px-4 py-2.5 text-sm font-semibold text-white"
        >
          Apply
        </button>
        {filtered && (
          <Link
            href="/admin/agents/prospects"
            className="press rounded-xl border border-ink-200 bg-white px-4 py-2.5 text-sm font-semibold text-ink-700"
          >
            Clear
          </Link>
        )}
      </form>

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
                  {filtered
                    ? "No prospects match these filters."
                    : "No prospects yet. Turn on the Prospector and run a discovery sweep."}
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
                  <td className="px-4 py-3 text-xs text-ink-600">
                    {prospect.emirate ? (EMIRATE_LABELS[prospect.emirate] ?? prospect.emirate) : "—"}
                  </td>
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

      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm">
          <span className="num text-ink-500">
            Page {page} of {totalPages} · {totalCount} total
          </span>
          <div className="flex gap-2">
            {page > 1 && (
              <Link
                href={filterHref({ page: String(page - 1) })}
                className="press rounded-lg border border-ink-200 bg-white px-4 py-2 font-semibold text-ink-700"
              >
                ← Previous
              </Link>
            )}
            {page < totalPages && (
              <Link
                href={filterHref({ page: String(page + 1) })}
                className="press rounded-lg border border-ink-200 bg-white px-4 py-2 font-semibold text-ink-700"
              >
                Next →
              </Link>
            )}
          </div>
        </div>
      )}

      <div className="rounded-xl border border-ink-200 bg-white p-5">
        <SuppressForm />
      </div>
    </div>
  );
}
