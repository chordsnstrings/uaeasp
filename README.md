# UAE E-Invoicing Provider Directory + Lead-Gen CRM

A bilingual (English/Arabic, full RTL) SEO-optimized directory of all UAE Ministry of
Finance **pre-approved e-invoicing service providers (ASPs)**, built as a lead-generation
funnel with a granular sales CRM, a client request-tracking portal, and a nightly
self-updating provider database.

## What's inside

| Area | Details |
|---|---|
| **Public site** | Home, provider directory (`/providers`, `/providers/<slug>`), readiness quiz (`/assessment`), FAQ, get-matched lead form, request tracking (`/track`), about/privacy/disclaimer. English at `/`, Arabic at `/ar` with hreflang pairs. |
| **SEO / LLM** | SSG/ISR pages, JSON-LD (WebSite, Organization, ItemList, FAQPage, BreadcrumbList), dynamic `sitemap.xml`, `robots.txt`, live-generated `llms.txt`, dynamic OG images, live provider count in titles. |
| **PWA** | Serwist service worker, offline fallback, installable manifest + maskable icons. |
| **Lead capture** | Form + quiz funnel into `POST /api/leads`: honeypot + time-trap, Postgres rate limiting, optional Cloudflare Turnstile, PDPL consent timestamp, duplicate flagging, UTM/referrer capture. Instant email to sales + confirmation email (with tracking link) to the client. |
| **Client portal** | Every lead gets a private tracking token. Clients follow status at `/track/<token>` (also reachable via email+phone lookup at `/track`). Statuses are mapped to client-safe steps. |
| **Admin CRM** (`/admin`) | Auth.js credentials login (roles: `admin`, `sales`). Dashboard (pipeline counts, win rate, weekly volume, sources), filterable lead table, lead detail with status pipeline / assignment / notes / activity timeline, CSV export (UTF-8 BOM), provider management with scrape-protected manual overrides, data-refresh history with diffs, team management, audit log. |
| **Auto-updating directory** | GitHub Actions cron (nightly, 02:00 UAE) runs a Playwright scraper against the official MOF list with a PDF fallback, then POSTs to `/api/ingest/providers`. Server-side reconciler applies sanity gates, never deletes, delists only after 2 consecutive missing runs, preserves admin overrides, records diffs, and emails alerts. The public site only ever shows a neutral "Directory last updated" date. |

## Stack

Next.js 15 (App Router, standalone output) · TypeScript · Tailwind CSS v4 ·
Drizzle ORM + PostgreSQL · Auth.js v5 · next-intl · Motion (Framer Motion) · Serwist ·
Zod · Nodemailer (any SMTP) · Vitest · Playwright (scraper only, runs in CI).

## Local development

```bash
# 1. Postgres (any local instance works)
createdb uaeasp && createdb uaeasp_test

# 2. Configure
cp .env.example .env   # defaults match a local postgres:devpass setup

# 3. Install, migrate, seed
npm install
npm run db:migrate
npm run db:seed        # loads the hand-compiled provider seed list

# 4. First admin user
npm run user:create -- admin@example.com yourpassword Admin Name --role admin

# 5. Run
npm run dev            # http://localhost:3000 (public) + /admin (CRM)
```

Tests (`npm test`) cover the reconcile engine's fail-safes (rejection gates, 2-miss
delisting, admin-override protection, suffix/domain matching, slug stability) and the
scraper's extraction heuristics. They need the `uaeasp_test` database.

Emails: without `SMTP_HOST` set, emails are logged to the console instead of sent —
lead capture never depends on SMTP availability.

## Deploying to DigitalOcean App Platform

1. **Create the app**: `doctl apps create --spec .do/app.yaml` (or import the spec in
   the dashboard). It defines the web service (Dockerfile, port 3000, `/api/health`
   check) and a managed Postgres 16 cluster. Migrations run automatically on every
   container start (idempotent).
2. **Set secrets** in the dashboard: `AUTH_SECRET`, `INGEST_SECRET`, `IP_HASH_SALT`
   (generate each with `openssl rand -base64 32`), `SMTP_PASS`, and the real values for
   the `CHANGE-ME` placeholders (domain, notification emails).
3. **Domain**: add your domain under Settings → Domains, update
   `NEXT_PUBLIC_SITE_URL`, `AUTH_URL` and `EMAIL_FROM`, then redeploy. All canonical
   URLs, sitemaps, JSON-LD and email links follow `NEXT_PUBLIC_SITE_URL` — nothing else
   to change when the domain is decided.
4. **Email (Resend SMTP recommended)**: create a Resend account, verify the domain
   (SPF + DKIM records), set `SMTP_PASS` to the API key. Any other SMTP provider works —
   it's plain SMTP config. Add a DMARC record for deliverability.
5. **Seed the directory**: either run `npm run db:seed` from a one-off App Platform
   console, or simply trigger the first scrape (step 7), which fully populates it.
6. **Bootstrap the first admin** (console): `npm run user:create -- you@domain.ae
   <password> Your Name --role admin`. Further users are managed in `/admin/users`.
7. **GitHub secrets for the scraper**: in the repo settings add
   `INGEST_URL=https://<your-domain>/api/ingest/providers` and the same
   `INGEST_SECRET` as the app. Then run the **"Refresh provider directory"** workflow
   manually once and review the result in `/admin/scrapes`. The nightly cron takes over
   from there.

### AI profile drafts (optional)

When a **new** provider appears on the official list, it arrives with only a name,
website and contacts. If `AI_API_BASE_URL`, `AI_API_KEY` and `AI_MODEL` are set on the
app (any OpenAI-compatible API — DeepSeek `deepseek-chat`, GLM `glm-4-plus`, etc.), the
refresh auto-drafts a conservative English + Arabic profile and category for it,
**filling empty fields only** — existing content and admin edits are never touched, and
every draft is recorded in the audit log. Without a key, new providers show a neutral
fallback line until an admin writes the profile. All structural updates (new pages,
counts, registry rows, sitemap, delistings) are deterministic and never involve AI.

### How the auto-refresh stays safe

- **Sanity gates**: a payload with < 20 providers, < 60% of the last good count, or
  with > 50% of known providers missing is *rejected* — recorded with its raw payload
  for review, alert emailed, live data untouched.
- **Never delete**: providers missing from a refresh are delisted (kept public with a
  "no longer listed" notice, preserving URLs/SEO) only after **2 consecutive** missing
  runs, and restored automatically if they reappear.
- **Admin overrides win**: any provider field edited in `/admin/providers` is marked
  and never overwritten by a refresh.
- **Escalation**: 2+ consecutive failed/rejected runs trigger an escalated alert email.
- **Fallback chain**: HTML (real Chromium) → official PDF mirror → manual JSON upload
  by an admin through the same ingest endpoint (`POST /api/ingest/providers` with an
  admin session or the Bearer secret).

If the MOF WAF ever blocks GitHub's runners, the workflow fails gracefully (alert email,
directory untouched). Options, in order: re-run manually (IPs rotate), add a stealth
plugin, run the scraper from any machine with
`INGEST_URL=... INGEST_SECRET=... npm run scrape` inside `scraper/`, or paste the list
via the manual upload path.

### Runtime settings (/admin/settings)

SMTP, notification recipients, AI-draft credentials and the ingest secret are all
editable at runtime in **/admin/settings** (admin role only). Values saved there are
stored in the database, override the corresponding env vars immediately (no redeploy),
and secrets are write-only — masked after saving, changes audit-logged by field name
only. Env vars remain the bootstrap/fallback, so a fresh deploy works before the first
admin login. The page also shows the exact ingest URL to copy into GitHub secrets and
has a send-test-email button to verify SMTP.

## Operations notes

- **CRM workflow**: leads arrive as `new` → sales moves them through
  `contacted → qualified → matched → closed_won/closed_lost`. Every change is on the
  lead's timeline and in the audit log. The client's tracking page reflects these as
  client-safe steps automatically.
- **CSV export** respects the active filters and opens correctly in Excel with Arabic.
- **Duplicate leads** (same email or phone within 14 days) are kept but flagged and
  linked, so sales sees repeat interest instead of losing it.
- **Rotating a tracking link**: not currently exposed in the UI; update the lead's
  `tracking_token` in the database if a link leaks.
- **PDPL**: the form requires consent (stored with timestamp), IPs are stored only as
  salted hashes, and the privacy policy documents rights and retention.

## Repo layout

```
src/app/[locale]/…       public site (en/ar)
src/app/admin/…          CRM (login + dashboard group)
src/app/api/…            leads, ingest, track lookup, auth, og, health, export
src/lib/…                auth, data, email, ingest/reconcile, leads, rate-limit, validation
src/db/…                 Drizzle schema + migrations
db-seed/                 hand-compiled provider seed JSON
scraper/                 standalone Playwright scraper (GitHub Actions)
.github/workflows/       ci.yml + scrape-mof.yml (nightly cron)
.do/app.yaml             DigitalOcean App Platform spec
Dockerfile               standalone production image (runs migrations on start)
```
