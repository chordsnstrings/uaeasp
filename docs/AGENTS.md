# Growth agents

Four agents share one runway: a Postgres job queue, a heartbeat that drains it,
an approval gate, and a permanent do-not-contact list. Everything is off by
default — an agent runs only when the master switch, its own switch and its
credentials are all in place.

| Agent | What it does | Needs |
| --- | --- | --- |
| **Prospector** | Sweeps Google Places by sector × emirate, crawls each business's own site for a public contact address, verifies it, scores the fit with AI | Google Places API key |
| **Conversationalist** | Opens a thread per qualified prospect, writes the first touch, follows up, reads replies, converts interest into CRM leads | Amazon SES + sender identity |
| **Visibility** | Tracks keyword positions, drafts the pages we're missing into `/insights`, keeps a citation checklist, drafts link outreach | Search API key (optional) |
| **Analyst** | Weekly report: what moved, what's broken, what to do next | Nothing (email optional) |

## How work flows

```
Places sweep ──▶ prospects ──▶ crawl + verify ──▶ AI score ──▶ contactable
                                                                   │
                                              ┌────────────────────┘
                                              ▼
                                    outreach thread + first touch
                                              │
                          ┌───────────────────┼────────────────────┐
                          ▼                   ▼                    ▼
                    no reply → follow-up   reply → classify   bounce → suppress
                                              │
                              ┌───────────────┼───────────────┐
                              ▼               ▼               ▼
                        interested       question       unsubscribe
                              │               │               │
                         CRM lead +      AI drafts       suppressed
                       sales alert       a reply         permanently
```

Nothing sends until it passes three gates in order: **suppression list →
daily cap (warm-up ramped) → approval mode**.

## One-time setup

### 1. Amazon SES

DigitalOcean blocks outbound SMTP, so all agent mail goes over the SES HTTPS
API. In the AWS console, in the region you intend to use (`eu-west-1` is
closest to the UAE with full feature support):

1. **Verify the sending domain.** SES → Identities → Create identity → Domain →
   `send.uaeasp.ae`. Enable Easy DKIM and add the three CNAME records it gives
   you to the DigitalOcean DNS zone.
2. **Add SPF and DMARC** to the same zone:
   - `send.uaeasp.ae TXT "v=spf1 include:amazonses.com ~all"`
   - `_dmarc.uaeasp.ae TXT "v=DMARC1; p=none; rua=mailto:dmarc@uaeasp.ae"`
     (move to `p=quarantine` after a few weeks of clean reports)
3. **Request production access.** SES starts in sandbox mode and will only send
   to verified addresses. Account dashboard → Request production access.
4. **Create an IAM user** with only `ses:SendEmail` and `ses:SendRawEmail`.
   Put the access key and secret into `/admin/agents`.

### 2. Replies, bounces and complaints (SNS)

One endpoint handles all three: `https://uaeasp.ae/api/outreach/sns`. It
verifies Amazon's signature on every message and auto-confirms its own
subscription, so there is no console click-through.

- **Replies**: SES → Email receiving → Rule set → add a rule for
  `send.uaeasp.ae` with an **SNS action** (inline delivery, not S3), and point
  the topic's HTTPS subscription at the endpoint. Add the MX record SES gives
  you for the receiving domain.
- **Bounces and complaints**: SES → Configuration sets → create one (e.g.
  `uaeasp-outreach`) → Event destinations → SNS → subscribe the same endpoint.
  Put the configuration set name in `/admin/agents`.

A permanent bounce or any complaint adds the address to the suppression list
immediately and closes its thread. That list is never cleared.

### 3. Heartbeat

**Nothing to do — the app keeps its own clock.** `src/instrumentation.ts` arms
a timer when the server boots that beats every five minutes by calling its own
`/api/agents/tick` over the loopback interface, authenticated with the
`INGEST_SECRET` environment variable. Each beat:

1. runs the **nightly provider-directory refresh** if it is due (this happens
   whether or not the agents are switched on),
2. enqueues any periodic agent work that is due,
3. drains a bounded slice of the queue.

Every beat claims a slot in the database first, so concurrent callers can never
double up. Set `DISABLE_INTERNAL_SCHEDULER=true` to turn the timer off.

Two optional redundancies:

- **GitHub Actions** — add repository secrets `AGENT_TICK_URL` =
  `https://uaeasp.ae/api/agents/tick` and `INGEST_SECRET`, and the *Agent
  heartbeat* workflow ticks every 15 minutes as well. Note that GitHub only
  runs scheduled workflows on the repository's **default branch**.
- **Manually** — press **Run agents now** in `/admin/agents`, which forces a
  beat immediately, ignoring the spacing rule.

#### The nightly directory refresh

Independent of the agents entirely. It runs once per Dubai day, no earlier than
02:00 Dubai, and catches up automatically if more than 26 hours pass without a
successful run. A failed fetch is not retried for 30 minutes, so a broken
source cannot hammer itself. The result appears in `/admin/scrapes` exactly as
the GitHub workflow's runs do, tagged `auto`.

### 4. Google Places (Prospector)

Enable the **Places API (New)** in Google Cloud, create an API key restricted
to that API, and paste it into `/admin/agents`. Text Search costs roughly
$32 per 1,000 requests; each request returns up to 20 businesses, and the
daily discovery cap bounds the spend.

### 5. Search API (Visibility, optional)

Either [Serper](https://serper.dev) (Google results, ~$50 for 50k queries) or
Bing Web Search. Without one, the Visibility agent still drafts content and
tracks citations — it just cannot check live rankings or find link targets.

## Operating it

**Start manual.** Approval mode `manual` means every email waits in
`/admin/agents/approvals` where you can edit it before it sends. Read the
first twenty. When the copy is consistently right, move to `first_touch`
(sequence sends itself, replies still wait), and only then to `auto`.

**Warm up slowly.** A new sending domain that suddenly emits 200 emails a day
lands in spam folders permanently. The default ramp starts at 20/day and grows
1.4× daily to the cap — leave it alone for the first month.

**Watch three numbers.** In the weekly report: bounce rate (must stay under
2%), complaint rate (under 0.1% — SES suspends accounts above that), and reply
rate (under 3% means the copy or the targeting is wrong, not the volume).

**The kill switch works instantly.** Turning off the master switch stops the
next tick from draining anything. In-flight tasks are parked, not failed, so
switching back on resumes where it stopped.

## What each agent will not do

- The Visibility agent **never posts a link anywhere automatically**. Automated
  link dropping is neutralised by Google's link-spam classifier and, at volume,
  earns a manual action against the domain. It finds and drafts; a human posts.
- The Conversationalist **never states a fact about the mandate that is not in
  its verified-facts list**, and never invents anything about the recipient's
  company.
- No agent emails an address on the suppression list, ever, for any reason.
- Nothing is published to the public site without a human pressing publish.

## Files

| Path | Purpose |
| --- | --- |
| `src/lib/agents/queue.ts` | Job queue (claim with `FOR UPDATE SKIP LOCKED`, backoff, dedupe) |
| `src/lib/agents/runner.ts` | Dispatch table and run recording |
| `src/lib/agents/scheduler.ts` | Periodic work as idempotent enqueues |
| `src/lib/agents/ses.ts` | SES v2 transport, SigV4 signed by hand, raw MIME |
| `src/lib/agents/mailer.ts` | Suppression, caps, warm-up, the only send path |
| `src/lib/agents/mime.ts` | Inbound parsing and quoted-reply stripping |
| `src/lib/agents/sns.ts` | Amazon SNS signature verification |
| `src/lib/agents/prospector/` | Places discovery, polite crawler, verification |
| `src/lib/agents/conversationalist/` | Sequences, reply handling, lead conversion |
| `src/lib/agents/visibility/` | Rank checks, content drafting, link outreach |
| `src/lib/agents/analyst/` | Weekly metrics, narrative, recommendations |
| `src/app/api/agents/tick` | Heartbeat endpoint |
| `src/app/api/outreach/sns` | Replies, bounces, complaints |
| `src/app/api/outreach/unsubscribe` | One-click opt-out (RFC 8058) |
