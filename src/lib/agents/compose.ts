import { SITE_NAME, SITE_URL, absoluteUrl } from "@/lib/site";
import { clickUrl, openPixelUrl } from "./tracking";
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
export const CTA_LABEL = "See what applies to you";

export function appendSignature(
  body: string,
  config: AgentConfig,
  threadToken: string,
): string {
  const signature = senderBlock(config);
  const cta = `${CTA_LABEL}: ${absoluteUrl(`/o/${threadToken}`)}`;
  const optOut = `Unsubscribe: ${unsubscribeUrl(threadToken)}`;
  return [body.trim(), cta, signature, optOut].filter(Boolean).join("\n\n");
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * The HTML body, built from the parts rather than parsed back out of the text.
 *
 * The plain-text version has to spell every URL out — a text-only client has
 * nowhere else to put them. HTML does not, and printing them anyway is what
 * made these emails look automated: a ninety-word message under a
 * forty-character tracking URL and a line of hex for the opt-out.
 *
 * So the link gets words. "See what applies to you" is the anchor, sized like
 * something you press; the signature is quiet; the opt-out is one small word
 * at the bottom where an opt-out belongs.
 */
export function renderHtml(
  parts: { body: string; ctaUrl: string; ctaLabel: string; signature: string; optOutUrl: string },
  trackToken?: string,
): string {
  const paragraphs = normalizeNewlines(parts.body)
    .trim()
    .split(/\n{2,}/)
    .map((para) => `<p style="margin:0 0 14px">${escapeHtml(para).replace(/\n/g, "<br />")}</p>`)
    .join("");

  const cta = trackToken ? clickUrl(trackToken, pathOf(parts.ctaUrl)) : parts.ctaUrl;

  const signature = parts.signature
    .split("\n")
    .filter(Boolean)
    .map((line) =>
      /^https?:\/\//.test(line)
        ? `<a href="${escapeHtml(trackToken ? clickUrl(trackToken, pathOf(line)) : line)}" style="color:#0f766e;text-decoration:none">${escapeHtml(
            line.replace(/^https?:\/\//, "").replace(/\/$/, ""),
          )}</a>`
        : escapeHtml(line),
    )
    .join("<br />");

  return [
    `<div style="font:15px/1.65 -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#0f172a;max-width:560px">`,
    paragraphs,
    `<p style="margin:0 0 22px"><a href="${escapeHtml(cta)}" style="display:inline-block;background:#0f766e;color:#ffffff;text-decoration:none;padding:10px 18px;border-radius:8px;font-weight:600">${escapeHtml(
      parts.ctaLabel,
    )}</a></p>`,
    `<p style="margin:0;color:#475569;font-size:13px;line-height:1.6">${signature}</p>`,
    `<p style="margin:18px 0 0;color:#94a3b8;font-size:11px">`,
    // Never routed through the click tracker: an opt-out must not depend on a
    // hop that can fail.
    `<a href="${escapeHtml(parts.optOutUrl)}" style="color:#94a3b8">unsubscribe</a>`,
    `</p>`,
    `</div>`,
    trackToken
      ? `<img src="${openPixelUrl(trackToken)}" width="1" height="1" alt="" style="display:block;width:1px;height:1px;border:0" />`
      : "",
  ].join("");
}

/**
 * Collapse CRLF and lone CR to LF before anything reads line structure.
 *
 * Without this a body that arrived with Windows line endings leaves a stray
 * \r at the end of every line, the "Label: URL" match fails on its end anchor,
 * and the link quietly falls back to printing the URL — the exact defect this
 * renderer exists to remove, reappearing only for some inputs.
 */
function normalizeNewlines(value: string): string {
  return value.replace(/\r\n?/g, "\n");
}

/** Our own absolute URL down to the path the click tracker redirects to. */
function pathOf(url: string): string {
  return url.startsWith(SITE_URL) ? url.slice(SITE_URL.length) || "/" : "/";
}

/**
 * Legacy renderer, for messages drafted before the parts were kept separately.
 *
 * All it has is the finished text, so it reads the shape back out: a line of
 * "Label: https://…" becomes a link labelled with the words, not the URL.
 * Worse than building from the parts, much better than printing raw URLs.
 */
export function textToHtml(text: string, trackToken?: string): string {
  const linkify = (url: string): string => {
    const isOptOut = url.includes("/api/outreach/unsubscribe");
    const href = trackToken && !isOptOut ? clickUrl(trackToken, pathOf(url)) : url;
    const label = isOptOut
      ? "unsubscribe"
      : url.replace(/^https?:\/\//, "").replace(/\/$/, "");
    const short = label.length > 44 ? `${label.slice(0, 41)}…` : label;
    return `<a href="${escapeHtml(href)}" style="color:#0f766e">${escapeHtml(short)}</a>`;
  };

  const rendered = normalizeNewlines(text)
    .split("\n")
    .map((line) => {
      // "See what applies to you: https://…" — the words are a far better
      // label than the URL, and the URL adds nothing once it is a link.
      const labelled = line.match(/^(.{2,60}?):\s+(https?:\/\/\S+)$/);
      if (labelled) {
        const [, label, url] = labelled;
        const isOptOut = url.includes("/api/outreach/unsubscribe");
        const href = trackToken && !isOptOut ? clickUrl(trackToken, pathOf(url)) : url;
        return `<a href="${escapeHtml(href)}" style="color:#0f766e">${escapeHtml(
          isOptOut ? "unsubscribe" : label,
        )}</a>`;
      }
      return escapeHtml(line).replace(/(https?:\/\/[^\s<]+)/g, (url) => linkify(url));
    })
    .join("\n");

  const html = `<div style="font:15px/1.65 -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#0f172a;max-width:560px;white-space:pre-wrap">${rendered}</div>`;
  if (!trackToken) return html;
  return `${html}<img src="${openPixelUrl(trackToken)}" width="1" height="1" alt="" style="display:block;width:1px;height:1px;border:0" />`;
}

/**
 * Everything a send needs, built from the writer's words and today's rules.
 *
 * The two halves are deliberately different. The text keeps every URL spelled
 * out, because a text-only client has nowhere else to put them. The HTML is
 * assembled from the parts, so the link can carry words instead.
 */
export function composeBody(
  raw: string,
  config: AgentConfig,
  threadToken: string,
  trackToken: string,
): { text: string; html: string } {
  return {
    text: appendSignature(raw, config, threadToken),
    html: renderHtml(
      {
        body: raw,
        ctaUrl: absoluteUrl(`/o/${threadToken}`),
        ctaLabel: CTA_LABEL,
        signature: senderBlock(config),
        optOutUrl: unsubscribeUrl(threadToken),
      },
      trackToken,
    ),
  };
}

/**
 * Exactly what the send path will transmit, without sending it.
 *
 * The approval screen promises "what they will see", and that promise is only
 * kept if the preview is built the way the send is. Reading the stored HTML
 * instead would show the rendering a message was drafted with — which, for
 * anything written before the parts were split, is precisely the old raw-URL
 * version we no longer send.
 */
export function previewHtml(
  message: { bodyRaw: string | null; bodyText: string; trackToken: string },
  config: AgentConfig,
  threadToken: string,
): string {
  return message.bodyRaw
    ? composeBody(message.bodyRaw, config, threadToken, message.trackToken).html
    : textToHtml(message.bodyText, message.trackToken);
}

export function needsRecompose(message: { bodyRaw: string | null }): boolean {
  return message.bodyRaw === null;
}
