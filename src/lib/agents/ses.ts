import { createHash, createHmac } from "node:crypto";
import { getAgentConfig, type AgentConfig } from "./config";

/**
 * Amazon SES v2 transport, signed with SigV4 by hand.
 *
 * DigitalOcean App Platform blocks outbound SMTP, so all agent mail goes over
 * the HTTPS API. No AWS SDK: one signed POST is far less weight than pulling
 * in @aws-sdk/* for a single call, and it keeps cold starts small.
 *
 * Sends raw MIME (SendEmail → Content.Raw) because agent mail needs headers
 * the Simple content type cannot express: In-Reply-To/References for correct
 * threading, and List-Unsubscribe for one-click opt-out.
 */

const SERVICE = "ses";

function sha256Hex(data: string | Buffer): string {
  return createHash("sha256").update(data).digest("hex");
}

function hmac(key: Buffer | string, data: string): Buffer {
  return createHmac("sha256", key).update(data, "utf8").digest();
}

function signingKey(secret: string, date: string, region: string): Buffer {
  const kDate = hmac(`AWS4${secret}`, date);
  const kRegion = hmac(kDate, region);
  const kService = hmac(kRegion, SERVICE);
  return hmac(kService, "aws4_request");
}

/** RFC 2047 encoded-word — keeps non-ASCII subjects and names legal in headers. */
export function encodeHeaderWord(value: string): string {
  // eslint-disable-next-line no-control-regex
  // Control characters — CR and LF above all — must never reach a header.
  // Company names come from scraped websites and subjects from model output,
  // so a bare "\r\nBcc: victim@example.com" would otherwise inject a header
  // and SES would take its envelope recipients from it.
  // eslint-disable-next-line no-control-regex
  const clean = value.replace(/[\x00-\x1F\x7F]+/g, " ").trim();
  // eslint-disable-next-line no-control-regex
  if (/^[\x20-\x7E]*$/.test(clean)) return clean;
  // RFC 2047 caps an encoded-word at 75 characters, so long non-ASCII values
  // are emitted as several space-separated words rather than one illegal one.
  const bytes = Buffer.from(clean, "utf8");
  const words: string[] = [];
  // 45 bytes of input -> 60 base64 chars, comfortably inside the 75 limit.
  for (let i = 0; i < bytes.length; i += 45) {
    words.push(`=?UTF-8?B?${bytes.subarray(i, i + 45).toString("base64")}?=`);
  }
  return words.join("\r\n ");
}

/** An address is only ever a single addr-spec — never a header continuation. */
export function sanitizeAddress(value: string): string {
  // eslint-disable-next-line no-control-regex
  const clean = value.replace(/[\x00-\x1F\x7F,;<>]+/g, "").trim();
  if (!/^[^\s@]+@[^\s@]+\.[a-zA-Z]{2,}$/.test(clean)) {
    throw new Error(`refusing to build a message with an invalid address: ${JSON.stringify(value)}`);
  }
  return clean;
}

/** Header values that are not addresses or encoded words still must not fold. */
function sanitizeHeaderValue(value: string): string {
  // eslint-disable-next-line no-control-regex
  return value.replace(/[\x00-\x1F\x7F]+/g, " ").trim();
}

function foldBase64(input: string): string {
  return (input.match(/.{1,76}/g) ?? []).join("\r\n");
}

export interface RawMessageInput {
  from: string;
  fromName?: string;
  to: string;
  replyTo?: string;
  subject: string;
  text: string;
  html?: string;
  messageId: string;
  inReplyTo?: string | null;
  references?: string | null;
  /** One-click unsubscribe URL — required on every cold outbound email. */
  unsubscribeUrl?: string;
  headers?: Record<string, string>;
}

/** Build an RFC 5322 message. Multipart/alternative when HTML is supplied. */
export function buildRawMessage(input: RawMessageInput): string {
  // Every address is validated, and every free-text header value is stripped
  // of control characters, before any of it is concatenated into the message.
  const from = sanitizeAddress(input.from);
  const to = sanitizeAddress(input.to);
  const messageId = sanitizeHeaderValue(input.messageId).replace(/[<>\s]/g, "");
  const boundary = `b_${messageId.replace(/[^a-zA-Z0-9]/g, "").slice(0, 24)}`;
  const fromHeader = input.fromName
    ? `${encodeHeaderWord(input.fromName)} <${from}>`
    : from;

  const headers: string[] = [
    `From: ${fromHeader}`,
    `To: ${to}`,
    `Subject: ${encodeHeaderWord(input.subject)}`,
    `Message-ID: <${messageId}>`,
    `Date: ${new Date().toUTCString()}`,
    "MIME-Version: 1.0",
  ];
  if (input.replyTo) headers.push(`Reply-To: ${sanitizeAddress(input.replyTo)}`);
  if (input.inReplyTo) {
    headers.push(`In-Reply-To: <${sanitizeHeaderValue(input.inReplyTo).replace(/[<>\s]/g, "")}>`);
  }
  if (input.references) headers.push(`References: ${sanitizeHeaderValue(input.references)}`);
  if (input.unsubscribeUrl) {
    headers.push(`List-Unsubscribe: <${sanitizeHeaderValue(input.unsubscribeUrl)}>`);
    headers.push("List-Unsubscribe-Post: List-Unsubscribe=One-Click");
  }
  for (const [key, value] of Object.entries(input.headers ?? {})) {
    headers.push(`${sanitizeHeaderValue(key).replace(/[^A-Za-z0-9-]/g, "")}: ${sanitizeHeaderValue(value)}`);
  }

  const textPart = foldBase64(Buffer.from(input.text, "utf8").toString("base64"));

  if (!input.html) {
    headers.push('Content-Type: text/plain; charset="UTF-8"');
    headers.push("Content-Transfer-Encoding: base64");
    return `${headers.join("\r\n")}\r\n\r\n${textPart}\r\n`;
  }

  const htmlPart = foldBase64(Buffer.from(input.html, "utf8").toString("base64"));
  headers.push(`Content-Type: multipart/alternative; boundary="${boundary}"`);
  return [
    headers.join("\r\n"),
    "",
    `--${boundary}`,
    'Content-Type: text/plain; charset="UTF-8"',
    "Content-Transfer-Encoding: base64",
    "",
    textPart,
    "",
    `--${boundary}`,
    'Content-Type: text/html; charset="UTF-8"',
    "Content-Transfer-Encoding: base64",
    "",
    htmlPart,
    "",
    `--${boundary}--`,
    "",
  ].join("\r\n");
}

export interface SesSendResult {
  ok: boolean;
  providerMessageId?: string;
  error?: string;
  /** True when the failure looks permanent (bad address, suppressed, denied). */
  permanent?: boolean;
}

/** Low-level signed call to SES v2 SendEmail. */
export async function sesSendRaw(
  raw: string,
  config: AgentConfig,
): Promise<SesSendResult> {
  if (!(config.sesAccessKeyId && config.sesSecretAccessKey && config.sesFromEmail)) {
    return { ok: false, error: "SES is not configured", permanent: true };
  }
  const region = config.sesRegion || "eu-west-1";
  const host = `email.${region}.amazonaws.com`;
  const path = "/v2/email/outbound-emails";
  const body = JSON.stringify({
    Content: { Raw: { Data: Buffer.from(raw, "utf8").toString("base64") } },
    ...(config.sesConfigurationSet
      ? { ConfigurationSetName: config.sesConfigurationSet }
      : {}),
  });

  const now = new Date();
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, "");
  const dateStamp = amzDate.slice(0, 8);
  const payloadHash = sha256Hex(body);

  const canonicalHeaders =
    `content-type:application/json\n` +
    `host:${host}\n` +
    `x-amz-content-sha256:${payloadHash}\n` +
    `x-amz-date:${amzDate}\n`;
  const signedHeaders = "content-type;host;x-amz-content-sha256;x-amz-date";
  const canonicalRequest = [
    "POST",
    path,
    "",
    canonicalHeaders,
    signedHeaders,
    payloadHash,
  ].join("\n");

  const credentialScope = `${dateStamp}/${region}/${SERVICE}/aws4_request`;
  const stringToSign = [
    "AWS4-HMAC-SHA256",
    amzDate,
    credentialScope,
    sha256Hex(canonicalRequest),
  ].join("\n");
  const signature = hmac(
    signingKey(config.sesSecretAccessKey, dateStamp, region),
    stringToSign,
  ).toString("hex");

  const authorization =
    `AWS4-HMAC-SHA256 Credential=${config.sesAccessKeyId}/${credentialScope}, ` +
    `SignedHeaders=${signedHeaders}, Signature=${signature}`;

  try {
    const res = await fetch(`https://${host}${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Host: host,
        "X-Amz-Content-Sha256": payloadHash,
        "X-Amz-Date": amzDate,
        Authorization: authorization,
      },
      body,
      signal: AbortSignal.timeout(30_000),
    });
    const payload = (await res.json().catch(() => ({}))) as {
      MessageId?: string;
      message?: string;
      Message?: string;
      __type?: string;
    };
    if (!res.ok) {
      const detail = payload.message ?? payload.Message ?? `HTTP ${res.status}`;
      // 4xx other than throttling means the request itself is wrong: bad
      // address, unverified identity, denied permission. Retrying won't help.
      const permanent = res.status >= 400 && res.status < 500 && res.status !== 429;
      return { ok: false, error: `${payload.__type ?? "SESError"}: ${detail}`, permanent };
    }
    return { ok: true, providerMessageId: payload.MessageId };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

/** High-level send used by the agents. Builds the MIME then signs and posts. */
export async function sesSend(
  input: Omit<RawMessageInput, "from" | "fromName" | "replyTo"> & {
    from?: string;
    fromName?: string;
    replyTo?: string;
  },
): Promise<SesSendResult> {
  const config = await getAgentConfig();
  const raw = buildRawMessage({
    ...input,
    from: input.from ?? config.sesFromEmail,
    fromName: input.fromName ?? config.sesFromName,
    replyTo: input.replyTo ?? config.replyToEmail ?? config.sesFromEmail,
  });
  return sesSendRaw(raw, config);
}

/** Round-trip check for the admin console. */
export async function testSesConnection(
  to: string,
): Promise<{ ok: boolean; detail: string }> {
  const config = await getAgentConfig();
  if (!(config.sesAccessKeyId && config.sesSecretAccessKey && config.sesFromEmail)) {
    return {
      ok: false,
      detail: "SES needs an access key, secret key and verified sender address.",
    };
  }
  const result = await sesSend({
    to,
    subject: "SES test — UAE E-Invoicing Providers",
    text: "This is a test message from the agent console. If you received it, SES is wired up correctly.",
    messageId: `test-${Date.now()}@${config.sesFromEmail.split("@")[1] ?? "uaeasp.ae"}`,
  });
  return result.ok
    ? { ok: true, detail: `Sent. SES message id ${result.providerMessageId ?? "(none)"}.` }
    : { ok: false, detail: result.error ?? "Unknown SES error" };
}
