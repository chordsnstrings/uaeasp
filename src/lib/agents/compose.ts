import { SITE_NAME, SITE_URL, absoluteUrl } from "@/lib/site";
import { openPixelUrl, trackLinksInHtml } from "./tracking";
import { unsubscribeUrl } from "./mailer";
import type { AgentConfig } from "./config";

/**
 * Turning a writer's draft into a sendable message.
 *
 * This lives apart from the writer on purpose. The draft is the argument we
 * are making to one company; everything wrapped around it — signature, call to
 * action, opt-out, tracking — is policy that applies to every message we send.
 * Keeping the two separate is what lets the wrapper be rebuilt at send time,
 * so a draft written before a rule changed still goes out under the current
 * rule instead of preserving the old one until someone notices.
 */

export function senderBlock(config: AgentConfig): string {
  return [
    config.senderName,
    config.senderTitle,
    config.companyLegalName || SITE_NAME,
    absoluteUrl("/"),
    config.companyAddress,
  ]
    .filter(Boolean)
    .join("\n");
}

/**
 * The plain-text body: message, one link worth clicking, signature, opt-out.
 *
 * The personalised page carries the argument the email cannot — their deadline,
 * their emirate, a real shortlist — so the email's job is to earn one click,
 * not to explain everything.
 */
export function appendSignature(
  body: string,
  config: AgentConfig,
  threadToken: string,
): string {
  const signature = senderBlock(config);
  const cta = `See what applies to you: ${absoluteUrl(`/o/${threadToken}`)}`;
  const optOut = `Unsubscribe: ${unsubscribeUrl(threadToken)}`;
  return [body.trim(), cta, signature, optOut].filter(Boolean).join("\n\n");
}

/**
 * The HTML body. Long links render as short anchors, and our own links are
 * rewritten to the click tracker — except the unsubscribe, which is never
 * routed through anything that could fail.
 */
export function textToHtml(text: string, trackToken?: string): string {
  const escaped = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/(https?:\/\/[^\s<]+)/g, (url) => {
      const label = url.includes("/api/outreach/unsubscribe")
        ? "unsubscribe"
        : url.replace(/^https?:\/\//, "").replace(/\/$/, "");
      const short = label.length > 48 ? `${label.slice(0, 45)}…` : label;
      return `<a href="${url}" style="color:#0f766e">${short}</a>`;
    });
  const html = `<div style="font:15px/1.6 -apple-system,Segoe UI,sans-serif;color:#0f172a;white-space:pre-wrap">${escaped}</div>`;
  if (!trackToken) return html;
  return `${trackLinksInHtml(html, trackToken, SITE_URL)}<img src="${openPixelUrl(
    trackToken,
  )}" width="1" height="1" alt="" style="display:block;width:1px;height:1px;border:0" />`;
}

/** Everything a send needs, built from the writer's words and today's rules. */
export function composeBody(
  raw: string,
  config: AgentConfig,
  threadToken: string,
  trackToken: string,
): { text: string; html: string } {
  const text = appendSignature(raw, config, threadToken);
  return { text, html: textToHtml(text, trackToken) };
}

/**
 * Did this message go out under the rules we run today?
 *
 * Used to find drafts written before the current wrapper existed. `bodyRaw` is
 * the marker: every message composed since the split records it, and no
 * message written before the split can have it.
 */
export function needsRecompose(message: { bodyRaw: string | null }): boolean {
  return message.bodyRaw === null;
}
