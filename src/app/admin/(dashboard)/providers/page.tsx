import { asc } from "drizzle-orm";
import { db } from "@/db";
import { providers, type ProviderCategory } from "@/db/schema";
import { formatDateTime } from "@/components/admin/status";
import { ProviderEditor } from "@/components/admin/ProviderEditor";
import {
  Badge,
  BarList,
  ButtonLink,
  Card,
  Cell,
  DataTable,
  EmptyState,
  PageHeader,
  Row,
  SectionTitle,
  StatCard,
  type Tone,
} from "@/components/admin/ui";

export const dynamic = "force-dynamic";

const STATUS_TONE: Record<string, Tone> = {
  active: "positive",
  delisted: "warning",
  hidden: "neutral",
};

const STATUS_HINT: Record<string, string> = {
  active: "On the official list",
  delisted: "Shown with a notice",
  hidden: "Not shown publicly",
};

const CATEGORY_LABELS: Record<ProviderCategory, string> = {
  erp: "ERP / accounting",
  "tax-tech": "Tax technology",
  consulting: "Advisory",
  "edi-network": "E-invoicing / EDI",
  "enterprise-software": "Enterprise software",
  fintech: "Fintech / AP",
};

const CATEGORY_TONE: Record<ProviderCategory, Tone> = {
  erp: "brand",
  "tax-tech": "info",
  consulting: "neutral",
  "edi-network": "positive",
  "enterprise-software": "warning",
  fintech: "danger",
};

const SOURCE_LABELS: Record<string, string> = {
  seed: "Seed",
  scrape_html: "Refresh · HTML",
  scrape_pdf: "Refresh · PDF",
  manual: "Manual",
};

/** adminOverrides is untyped jsonb; count its keys without trusting the shape. */
function overrideCount(value: unknown): number {
  return value && typeof value === "object" ? Object.keys(value as object).length : 0;
}

export default async function AdminProvidersPage() {
  const rows = await db.select().from(providers).orderBy(asc(providers.name));

  const total = rows.length;
  const active = rows.filter((p) => p.status === "active").length;
  const delisted = rows.filter((p) => p.status === "delisted").length;
  const hidden = rows.filter((p) => p.status === "hidden").length;
  const flagged = rows.filter((p) => p.missingScrapeCount > 0).length;
  const edited = rows.filter((p) => overrideCount(p.adminOverrides) > 0).length;
  const share = (n: number) => (total ? `${Math.round((n / total) * 100)}% of the directory` : "—");

  const byCategory = new Map<string, number>();
  for (const p of rows) byCategory.set(p.category ?? "", (byCategory.get(p.category ?? "") ?? 0) + 1);

  const bySource = new Map<string, number>();
  for (const p of rows) bySource.set(p.source, (bySource.get(p.source) ?? 0) + 1);

  const completeness = [
    { label: "Website on file", value: rows.filter((p) => p.website).length },
    { label: "Contact people", value: rows.filter((p) => p.contacts.length > 0).length },
    { label: "English description", value: rows.filter((p) => p.description).length },
    { label: "Arabic name", value: rows.filter((p) => p.nameAr).length },
    { label: "Edited by hand", value: edited },
  ].map((item) => ({
    ...item,
    hint: total ? `${Math.round((item.value / total) * 100)}%` : undefined,
  }));

  return (
    <>
      <PageHeader
        title="Providers"
        count={total}
        subtitle="Directory entries are refreshed automatically from the official Ministry of Finance list. Anything you edit here is protected and survives every refresh."
        actions={<ButtonLink href="/admin/scrapes">Refresh history</ButtonLink>}
      />

      <section>
        <SectionTitle hint="What the public directory currently shows.">Composition</SectionTitle>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard label="Active" value={active} tone="positive" hint={share(active)} />
          <StatCard label="Delisted" value={delisted} tone="warning" hint={STATUS_HINT.delisted} />
          <StatCard label="Hidden" value={hidden} hint={STATUS_HINT.hidden} />
          <StatCard
            label="Missing from refreshes"
            value={flagged}
            tone={flagged > 0 ? "danger" : "neutral"}
            hint={
              flagged > 0
                ? "Absent from the official list on the last run or more."
                : "Every entry was found on the last run."
            }
          />
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-3">
        <Card>
          <SectionTitle hint="Uncategorised entries need a category before they rank well.">
            By category
          </SectionTitle>
          <BarList
            items={[...byCategory.entries()]
              .sort((a, b) => b[1] - a[1])
              .map(([key, value]) => ({
                label: key ? (CATEGORY_LABELS[key as ProviderCategory] ?? key) : "Uncategorised",
                value,
              }))}
            emptyLabel="No providers yet."
          />
        </Card>

        <Card>
          <SectionTitle hint="Where each record originally came from.">Provenance</SectionTitle>
          <BarList
            tone="info"
            items={[...bySource.entries()]
              .sort((a, b) => b[1] - a[1])
              .map(([key, value]) => ({ label: SOURCE_LABELS[key] ?? key, value }))}
            emptyLabel="No providers yet."
          />
        </Card>

        <Card>
          <SectionTitle hint="How complete the public profiles are.">Profile coverage</SectionTitle>
          <BarList tone="positive" items={completeness} emptyLabel="No providers yet." />
        </Card>
      </div>

      <section className="space-y-4">
        <SectionTitle hint="Alphabetical. Editing a field protects it from the automatic refresh.">
          Directory
        </SectionTitle>
        <DataTable
          head={["Provider", "Category", "Status", "Source", "Last seen", ""]}
          minWidth="66rem"
        >
          {rows.length === 0 ? (
            <EmptyState
              colSpan={6}
              title="No providers in the directory"
              body="Run a refresh against the official Ministry of Finance list to populate it."
              action={<ButtonLink href="/admin/scrapes">Go to refreshes</ButtonLink>}
            />
          ) : (
            rows.map((p) => {
              const overrides = overrideCount(p.adminOverrides);
              return (
                <Row key={p.id}>
                  <Cell>
                    <p className="font-semibold text-ink-900">{p.name}</p>
                    {p.nameAr && (
                      <p className="mt-0.5 text-xs text-ink-500" dir="rtl">
                        {p.nameAr}
                      </p>
                    )}
                    <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-ink-500">
                      <a
                        href={`/en/providers/${p.slug}`}
                        target="_blank"
                        rel="noreferrer"
                        className="num text-ink-500 underline decoration-ink-200 underline-offset-2 hover:text-brand-700"
                        dir="ltr"
                      >
                        /{p.slug}
                      </a>
                      {p.website && (
                        <>
                          <span aria-hidden className="text-ink-300">
                            ·
                          </span>
                          <a
                            href={p.website}
                            target="_blank"
                            rel="noreferrer"
                            className="max-w-[18rem] truncate hover:text-brand-700"
                            dir="ltr"
                          >
                            {p.website.replace(/^https?:\/\//, "")}
                          </a>
                        </>
                      )}
                    </p>
                  </Cell>

                  <Cell>
                    {p.category ? (
                      <Badge tone={CATEGORY_TONE[p.category] ?? "neutral"}>
                        {CATEGORY_LABELS[p.category] ?? p.category}
                      </Badge>
                    ) : (
                      <span className="text-xs text-ink-400">Uncategorised</span>
                    )}
                  </Cell>

                  <Cell>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <Badge tone={STATUS_TONE[p.status] ?? "neutral"}>{p.status}</Badge>
                      {p.missingScrapeCount > 0 && (
                        <span
                          title={`Not found on the official list in the last ${p.missingScrapeCount} refresh${p.missingScrapeCount > 1 ? "es" : ""}`}
                        >
                          <Badge tone="danger">
                            <span className="num">{p.missingScrapeCount}</span> missed
                          </Badge>
                        </span>
                      )}
                      {overrides > 0 && (
                        <span
                          title={`${overrides} field${overrides > 1 ? "s" : ""} edited by hand and protected from the refresh`}
                        >
                          <Badge tone="info">
                            <span className="num">{overrides}</span> manual
                          </Badge>
                        </span>
                      )}
                    </div>
                  </Cell>

                  <Cell className="whitespace-nowrap text-xs text-ink-500">
                    {SOURCE_LABELS[p.source] ?? p.source}
                  </Cell>

                  <Cell className="num whitespace-nowrap text-xs text-ink-500">
                    {p.lastSeenInScrapeAt ? formatDateTime(p.lastSeenInScrapeAt) : "—"}
                  </Cell>

                  <Cell>
                    <div className="flex flex-col items-end gap-2">
                      <ProviderEditor
                        provider={{
                          id: p.id,
                          name: p.name,
                          nameAr: p.nameAr,
                          website: p.website,
                          description: p.description,
                          descriptionAr: p.descriptionAr,
                          status: p.status,
                          slug: p.slug,
                        }}
                      />
                    </div>
                  </Cell>
                </Row>
              );
            })
          )}
        </DataTable>
      </section>
    </>
  );
}
