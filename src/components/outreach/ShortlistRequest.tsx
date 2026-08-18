"use client";

import { useEffect, useRef, useState } from "react";
import { track } from "@/lib/analytics";

/**
 * The ask, on the page they already landed on.
 *
 * Every field here is optional, and that is the whole design. The thread token
 * already tells us who they are, which company, and which emirate — so the
 * minimum viable action is pressing one button. Volume and system are offered
 * because they genuinely change which three providers fit, not because we need
 * them: a lead with a blank volume is worth incomparably more than a visitor
 * who left.
 *
 * What it replaces was a link to /get-matched and an eleven-field page. Fifty
 * one people clicked through from an email and none of them ever arrived.
 */

const VOLUMES = [
  { value: "<100", label: "Under 100 a month" },
  { value: "100-1000", label: "100 – 1,000 a month" },
  { value: "1000-10000", label: "1,000 – 10,000 a month" },
  { value: "10000+", label: "More than 10,000 a month" },
];

export function ShortlistRequest({ token, company }: { token: string; company: string }) {
  const [volume, setVolume] = useState("");
  const [software, setSoftware] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "done" | "error">("idle");

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (state === "sending" || state === "done") return;
    setState("sending");
    try {
      const res = await fetch("/api/outreach/shortlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, invoiceVolume: volume, accountingSoftware: software }),
      });
      const data = (await res.json()) as { ok?: boolean };
      if (!res.ok || !data.ok) throw new Error("failed");
      track("outreach_shortlist_requested");
      setState("done");
    } catch {
      setState("error");
    }
  }

  if (state === "done") {
    return (
      <div className="border-s-2 border-brand-600 bg-white p-6">
        <p className="text-lg font-medium tracking-tight text-ink-900">
          Done — we will send it to you.
        </p>
        <p className="mt-2 text-sm leading-relaxed text-ink-700">
          Three accredited providers that fit {company}, with what each would need from you.
          It goes to the same address we wrote to. If anything looks wrong, just reply to
          that email.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={submit}>
      <p className="text-sm leading-relaxed text-ink-600">
        We already have your details from the email, so there is nothing you have to fill
        in. These two only sharpen the shortlist — skip them if you would rather.
      </p>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="eyebrow text-ink-500">
            Invoices a month <span className="font-normal text-ink-500">(optional)</span>
          </span>
          <select
            value={volume}
            onChange={(e) => setVolume(e.target.value)}
            className="mt-2 w-full rounded-md border border-ink-200 bg-white px-3 py-2.5 text-sm text-ink-900 focus:border-ink-900 focus:outline-none"
          >
            <option value="">Not sure</option>
            {VOLUMES.map((v) => (
              <option key={v.value} value={v.value}>
                {v.label}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="eyebrow text-ink-500">
            Accounting system <span className="font-normal text-ink-500">(optional)</span>
          </span>
          <input
            value={software}
            onChange={(e) => setSoftware(e.target.value)}
            placeholder="Tally, SAP, Zoho…"
            maxLength={120}
            className="mt-2 w-full rounded-md border border-ink-200 bg-white px-3 py-2.5 text-sm text-ink-900 placeholder:text-ink-400 focus:border-ink-900 focus:outline-none"
          />
        </label>
      </div>

      <button
        type="submit"
        disabled={state === "sending"}
        className="press mt-5 rounded-md bg-ink-900 px-6 py-3 text-sm font-medium text-paper hover:bg-brand-900 disabled:opacity-60"
      >
        {state === "sending" ? "Sending…" : "Send me the shortlist"}
      </button>

      {state === "error" && (
        <p className="mt-3 border-s-2 border-accent-500 ps-3 text-xs text-accent-800">
          That did not go through. Replying to our email works just as well.
        </p>
      )}
      <p className="mt-3 text-xs text-ink-500">
        Free. We are a directory, not a provider, and we are not paid to prefer one.
      </p>
    </form>
  );
}

/**
 * Pageview tracking for /o.
 *
 * These pages sit outside the locale tree and so never mounted the site's
 * Analytics component. That left the whole click-to-lead path unmeasurable:
 * we could see that someone clicked the email and that no lead appeared, and
 * nothing in between.
 */
export function OutreachAnalytics() {
  const sent = useRef(false);
  useEffect(() => {
    if (sent.current) return;
    sent.current = true;
    // Never the token — that identifies one recipient, and this analytics is
    // deliberately cookieless and non-identifying. "/o" is enough to see how
    // many people arrived against how many asked.
    track("outreach_page_view", "/o");
  }, []);
  return null;
}
