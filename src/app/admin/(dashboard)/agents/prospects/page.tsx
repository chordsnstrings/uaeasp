import Link from "next/link";
import { redirect } from "next/navigation";
import { and, asc, desc, eq, ilike, inArray, or, sql, type SQL } from "drizzle-orm";
import { db } from "@/db";
import { PROSPECT_STATUSES, prospectContacts, prospects, suppressions } from "@/db/schema";
import { auth } from "@/lib/auth";
import { getAgentConfig } from "@/lib/agents/config";
import { EMIRATE_LABELS, formatDateTime } from "@/components/admin/status";
import { SuppressForm } from "@/components/admin/AgentConsole";
import {
  Badge,
  BarList,
  ButtonLink,
  Card,
  Cell,
  DataTable,
  Dot,
  EmptyState,
  Field,
  PageHeader,
  Row,
  SectionTitle,
  StatCard,
  type Tone,
} from "@/components/admin/ui";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 25;

const VERIFICATION_LABEL: Record<string, string> = {
  mx_ok: "MX verified",
  syntax_ok: "syntax only",
  unknown: "unchecked",
  risky: "risky",
  invalid: "invalid",
};

/** How much an address can be trusted — read at a glance, not in prose. */
const VERIFICATION_TONE: Record<string, Tone> = {
  mx_ok: "positive",
  syntax_ok: "neutral",
  unknown: "neutral",
  risky: "warning",
  invalid: "danger",
};

type ProspectStatus = (typeof PROSPECT_STATUSES)[number];

const STATUS_LABEL: Record<ProspectStatus, string> = {
  discovered: "Discovered",
  enriched: "Enriched",
  contactable: "Contactable",
  sequenced: "Sequenced",
  replied: "Replied",
  converted: "Converted",
  rejected: "Rejected",
  suppressed: "Suppressed",
};

const STATUS_TONE: Record<ProspectStatus, Tone> = {
  discovered: "neutral",
  enriched: "info",
  contactable: "positive",
  sequenced: "brand",
  replied: "brand",
  converted: "positive",
  rejected: "danger",
  suppressed: "danger",
};

/** Thread status wins the badge when a conversation exists — it is the newer truth. */
const THREAD_TONE: Record<string, Tone> = {
  active: "brand",
  awaiting_reply: "info",
  replied: "brand",
  converted: "positive",
  closed: "neutral",
  bounced: "danger",
  unsubscribed: "danger",
};

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

  const [rows, countRow, counts, sectorRows, addressableRow, sectorCounts] = await Promise.all([
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
    // Two cheap roll-ups so the header can say what the whole list contains,
    // not just the slice currently on screen. Both are unfiltered on purpose:
    // they are the denominator the filtered count is read against.
    db.select({ count: sql<number>`count(*)::int` }).from(prospects).where(hasContact),
    db
      .select({ sector: prospects.sector, n: sql<number>`count(*)::int` })
      .from(prospects)
      .where(sql`${prospects.sector} is not null`)
      .groupBy(prospects.sector),
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

  /** A link that ignores the current filters — used by the unfiltered roll-ups. */
  const scopeHref = (patch: Record<string, string>) => {
    const qs = new URLSearchParams(patch).toString();
    return `/admin/agents/prospects${qs ? `?${qs}` : ""}`;
  };

  const contactableCount = counts.find((c) => c.status === "contactable")?.n ?? 0;
  const sequencedCount = counts.find((c) => c.status === "sequenced")?.n ?? 0;
  const rejectedCount = counts.find((c) => c.status === "rejected")?.n ?? 0;
  const allProspects = counts.reduce((sum, c) => sum + c.n, 0);
  const addressable = addressableRow[0]?.count ?? 0;
  const addressableShare = allProspects ? Math.round((addressable / allProspects) * 100) : 0;
  const filtered = Boolean(status || emirate || sector || contactable || q);

  const rangeStart = totalCount === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const rangeEnd = (page - 1) * PAGE_SIZE + rows.length;

  const approvalTone: Tone =
    config.outreachApprovalMode === "manual"
      ? "positive"
      : config.outreachApprovalMode === "first_touch"
        ? "warning"
        : "danger";

  const inputClass =
    "rounded-xl border border-ink-200 bg-white px-3 py-2.5 text-sm text-ink-800 transition-colors focus:border-brand-400 focus:ring-2 focus:ring-brand-100";

  return (
    <>
      <PageHeader
        title="Prospects"
        count={totalCount}
        subtitle={
          <>
            <p className="max-w-2xl">
              Every business the Prospector found, the exact address it would write to, and why it
              did or did not qualify. Anything scoring under{" "}
              <span className="num">{config.prospectorMinScore}</span> waits here instead of being
              emailed.
            </p>
            <p className="mt-1.5 inline-flex flex-wrap items-center gap-x-2 gap-y-1">
              <span>
                Showing <span className="num">{rangeStart.toLocaleString()}</span>–
                <span className="num">{rangeEnd.toLocaleString()}</span> of{" "}
                <span className="num">{totalCount.toLocaleString()}</span>
              </span>
              {filtered && (
                <>
                  <span className="text-ink-300">·</span>
                  <Link
                    href="/admin/agents/prospects"
                    className="font-semibold text-brand-700 hover:underline"
                  >
                    Clear filters
                  </Link>
                </>
              )}
            </p>
          </>
        }
        actions={<ButtonLink href="/admin/agents">← Agents</ButtonLink>}
      />

      <section>
        <SectionTitle hint="Across every prospect on record, whatever the filters below say.">
          At a glance
        </SectionTitle>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            label="Prospects found"
            value={allProspects.toLocaleString()}
            hint={
              filtered
                ? `${totalCount.toLocaleString()} match the current filters`
                : "Everything the Prospector has discovered"
            }
            tone="brand"
          />
          <StatCard
            label="Cleared to contact"
            value={contactableCount.toLocaleString()}
            hint={
              sequencedCount > 0
                ? `${sequencedCount.toLocaleString()} already in a sequence`
                : "Nothing is in a sequence yet"
            }
            tone={contactableCount > 0 ? "positive" : "neutral"}
            href={scopeHref({ status: "contactable" })}
          />
          <StatCard
            label="With a usable address"
            value={addressable.toLocaleString()}
            hint={`${addressableShare}% of everything found`}
            tone="info"
            href={scopeHref({ contactable: "yes" })}
          />
          <StatCard
            label="Rejected"
            value={rejectedCount.toLocaleString()}
            hint="No usable address, or failed the fit test"
            tone={rejectedCount > 0 ? "warning" : "neutral"}
            href={scopeHref({ status: "rejected" })}
          />
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <SectionTitle hint="Which search category surfaced them. Click a sector to see only those.">
            By sector
          </SectionTitle>
          <BarList
            items={sectorCounts
              .filter((r): r is { sector: string; n: number } => Boolean(r.sector))
              .sort((a, b) => b.n - a.n)
              .slice(0, 8)
              .map((r) => ({
                label: r.sector,
                value: r.n,
                href: scopeHref({ sector: r.sector }),
                hint: allProspects ? `${Math.round((r.n / allProspects) * 100)}%` : undefined,
              }))}
            emptyLabel="No sector recorded yet — run a discovery sweep."
          />
        </Card>

        <Card>
          <SectionTitle hint="What the Conversationalist is allowed to do with this list.">
            Sending rules
          </SectionTitle>
          <p className="text-sm text-ink-600">
            <span className="num font-semibold text-ink-900">
              {contactableCount.toLocaleString()}
            </span>{" "}
            {contactableCount === 1 ? "business is" : "businesses are"} cleared to be contacted.
          </p>
          <dl className="mt-4 grid gap-4 sm:grid-cols-2">
            <Field label="Approval mode">
              <Badge tone={approvalTone}>{config.outreachApprovalMode}</Badge>
            </Field>
            <Field label="Fit threshold">
              <span className="num">{config.prospectorMinScore}</span>
            </Field>
            <Field label="Daily cap">
              <span className="num">{config.outreachDailyCap}</span> / day
            </Field>
            <Field label="Warm-up start">
              <span className="num">{config.outreachWarmupStartCap}</span> / day
            </Field>
          </dl>
          {config.outreachApprovalMode === "manual" && (
            <p className="mt-4 text-xs leading-relaxed text-ink-500">
              Nothing leaves without you approving it in{" "}
              <Link href="/admin/agents/approvals" className="font-semibold text-brand-700 hover:underline">
                Approvals
              </Link>
              .
            </p>
          )}
        </Card>
      </div>

      <Card>
        {/* Status pills — a zero-count status stays hidden unless it is selected. */}
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href={filterHref({ status: undefined })}
            className={`press inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-semibold ring-1 transition-colors ${
              !status
                ? "bg-ink-900 text-white ring-ink-900"
                : "bg-white text-ink-600 ring-ink-200 hover:text-brand-800 hover:ring-brand-300"
            }`}
            aria-current={!status ? "page" : undefined}
          >
            All
            <span className={`num ${!status ? "text-white/70" : "text-ink-400"}`}>
              {allProspects.toLocaleString()}
            </span>
          </Link>
          {PROSPECT_STATUSES.map((s) => {
            const n = counts.find((c) => c.status === s)?.n ?? 0;
            if (!n && status !== s) return null;
            const active = status === s;
            return (
              <Link
                key={s}
                href={filterHref({ status: s })}
                className={`press inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-semibold ring-1 transition-colors ${
                  active
                    ? "bg-ink-900 text-white ring-ink-900"
                    : "bg-white text-ink-600 ring-ink-200 hover:text-brand-800 hover:ring-brand-300"
                }`}
                aria-current={active ? "page" : undefined}
              >
                {!active && <Dot tone={STATUS_TONE[s]} />}
                {STATUS_LABEL[s]}
                <span className={`num ${active ? "text-white/70" : "text-ink-400"}`}>
                  {n.toLocaleString()}
                </span>
              </Link>
            );
          })}
        </div>

        <form method="get" className="mt-4 flex flex-wrap gap-2 border-t border-ink-100 pt-4">
          {status && <input type="hidden" name="status" value={status} />}
          <input
            type="search"
            name="q"
            defaultValue={q ?? ""}
            placeholder="Search business, domain or email…"
            aria-label="Search prospects"
            className={`w-full max-w-xs ${inputClass}`}
          />
          <select
            name="emirate"
            defaultValue={emirate ?? ""}
            aria-label="Filter by emirate"
            className={inputClass}
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
            aria-label="Filter by sector"
            className={inputClass}
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
            aria-label="Filter by whether an address was found"
            className={inputClass}
          >
            <option value="">Any address</option>
            <option value="yes">Has an address</option>
            <option value="no">No address found</option>
          </select>
          <select name="sort" defaultValue={sort} aria-label="Sort order" className={inputClass}>
            <option value="score">Highest score</option>
            <option value="newest">Newest first</option>
          </select>
          <button
            type="submit"
            className="press rounded-xl bg-ink-900 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-ink-800"
          >
            Apply
          </button>
          {filtered && (
            <Link
              href="/admin/agents/prospects"
              className="press rounded-xl border border-ink-200 bg-white px-4 py-2.5 text-sm font-semibold text-ink-700 transition-colors hover:border-brand-300 hover:text-brand-800"
            >
              Clear
            </Link>
          )}
        </form>
      </Card>

      <DataTable
        head={["Business", "Will be contacted at", "Emirate", "Score", "Status", "Found"]}
        minWidth="64rem"
      >
        {rows.length === 0 && (
          <EmptyState
            colSpan={6}
            title={filtered ? "No prospects match these filters" : "No prospects yet"}
            body={
              filtered
                ? "Widen the search, or clear the filters to see every business on record."
                : "Turn on the Prospector and run a discovery sweep — found businesses land here for review before anything is sent."
            }
            action={
              filtered ? (
                <ButtonLink href="/admin/agents/prospects" variant="primary">
                  Clear filters
                </ButtonLink>
              ) : (
                <ButtonLink href="/admin/agents" variant="primary">
                  Open the Prospector
                </ButtonLink>
              )
            }
          />
        )}
        {rows.map(({ prospect, threadStatus }) => {
          const list = byProspect.get(prospect.id) ?? [];
          const primary = list[0];
          const alternates = list.length - 1;
          const suppressed = primary ? blocked.has(primary.email) : false;
          const meetsThreshold =
            prospect.score !== null && prospect.score >= config.prospectorMinScore;
          return (
            <Row key={prospect.id}>
              <Cell className="relative min-w-0">
                <Link
                  href={`/admin/agents/prospects/${prospect.id}`}
                  className="font-semibold text-ink-900 transition-colors after:absolute after:inset-0 hover:text-brand-800"
                >
                  {prospect.name}
                </Link>
                <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-ink-400">
                  {prospect.domain && (
                    <span className="num" dir="ltr">
                      {prospect.domain}
                    </span>
                  )}
                  {prospect.sector && <span className="text-ink-500">{prospect.sector}</span>}
                </p>
                {prospect.scoreReason && (
                  <p className="mt-1 max-w-md break-words text-xs leading-relaxed text-ink-500">
                    {prospect.scoreReason}
                  </p>
                )}
              </Cell>
              <Cell>
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
                    <p className="mt-1 flex flex-wrap items-center gap-1.5">
                      <Badge tone={VERIFICATION_TONE[primary.verification] ?? "neutral"}>
                        {VERIFICATION_LABEL[primary.verification] ?? primary.verification}
                      </Badge>
                      {primary.isRoleAccount && <Badge tone="neutral">shared mailbox</Badge>}
                      {suppressed && <Badge tone="danger">suppressed</Badge>}
                    </p>
                    {suppressed && (
                      <p className="mt-1 text-[11px] text-ink-500">Will not be mailed.</p>
                    )}
                    {alternates > 0 && (
                      <p className="num mt-1 text-[11px] text-ink-400">
                        +{alternates} other {alternates === 1 ? "address" : "addresses"} on file
                      </p>
                    )}
                  </>
                ) : (
                  <span className="text-xs text-ink-400">no address found</span>
                )}
              </Cell>
              <Cell className="whitespace-nowrap text-xs text-ink-600">
                {prospect.emirate ? (EMIRATE_LABELS[prospect.emirate] ?? prospect.emirate) : "—"}
              </Cell>
              <Cell className="text-end">
                <span
                  className={`num font-semibold ${
                    prospect.score === null
                      ? "text-ink-400"
                      : meetsThreshold
                        ? "text-emerald-700"
                        : "text-ink-900"
                  }`}
                >
                  {prospect.score ?? "—"}
                </span>
                {prospect.score !== null && (
                  <span className="ms-auto mt-1.5 block h-1 w-14 overflow-hidden rounded-full bg-ink-100">
                    <span
                      aria-hidden
                      className={`block h-full rounded-full ${
                        meetsThreshold ? "bg-emerald-400" : "bg-ink-300"
                      }`}
                      style={{ width: `${Math.min(100, Math.max(0, prospect.score))}%` }}
                    />
                  </span>
                )}
              </Cell>
              <Cell>
                {threadStatus ? (
                  <>
                    <Badge tone={THREAD_TONE[threadStatus] ?? "neutral"}>
                      {threadStatus.replace(/_/g, " ")}
                    </Badge>
                    <p className="mt-1 text-[11px] text-ink-400">
                      {STATUS_LABEL[prospect.status] ?? prospect.status}
                    </p>
                  </>
                ) : (
                  <Badge tone={STATUS_TONE[prospect.status] ?? "neutral"}>
                    {STATUS_LABEL[prospect.status] ?? prospect.status}
                  </Badge>
                )}
              </Cell>
              <Cell className="num whitespace-nowrap text-xs text-ink-500">
                {formatDateTime(prospect.createdAt)}
              </Cell>
            </Row>
          );
        })}
      </DataTable>

      {totalPages > 1 && (
        <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
          <span className="text-ink-500">
            Page <span className="num">{page}</span> of <span className="num">{totalPages}</span> ·{" "}
            <span className="num">{totalCount.toLocaleString()}</span> total
          </span>
          <div className="flex gap-2">
            {page > 1 && (
              <Link
                href={filterHref({ page: String(page - 1) })}
                className="press rounded-xl border border-ink-200 bg-white px-4 py-2 font-semibold text-ink-700 transition-colors hover:border-brand-300 hover:text-brand-800"
              >
                ← Previous
              </Link>
            )}
            {page < totalPages && (
              <Link
                href={filterHref({ page: String(page + 1) })}
                className="press rounded-xl border border-ink-200 bg-white px-4 py-2 font-semibold text-ink-700 transition-colors hover:border-brand-300 hover:text-brand-800"
              >
                Next →
              </Link>
            )}
          </div>
        </div>
      )}

      <Card>
        <SectionTitle hint="Added addresses are excluded from every sequence, permanently and immediately.">
          Suppression list
        </SectionTitle>
        <SuppressForm />
      </Card>
    </>
  );
}
