import { createVerify } from "node:crypto";

/**
 * Amazon SNS message verification.
 *
 * SNS is a public endpoint — anyone can POST to it — so every notification is
 * verified against Amazon's signing certificate before we act on it. The
 * certificate URL is pinned to amazonaws.com over HTTPS, which is what stops
 * an attacker pointing us at a certificate they control.
 */

export interface SnsEnvelope {
  Type: string;
  MessageId: string;
  TopicArn: string;
  Subject?: string;
  Message: string;
  Timestamp: string;
  SignatureVersion: string;
  Signature: string;
  SigningCertURL?: string;
  SigningCertUrl?: string;
  SubscribeURL?: string;
  Token?: string;
}

const SIGNABLE_KEYS: Record<string, string[]> = {
  Notification: ["Message", "MessageId", "Subject", "Timestamp", "TopicArn", "Type"],
  SubscriptionConfirmation: [
    "Message",
    "MessageId",
    "SubscribeURL",
    "Timestamp",
    "Token",
    "TopicArn",
    "Type",
  ],
  UnsubscribeConfirmation: [
    "Message",
    "MessageId",
    "SubscribeURL",
    "Timestamp",
    "Token",
    "TopicArn",
    "Type",
  ],
};

/** Bounded, expiring cache — the key is attacker-influenced, so it cannot grow
 * without limit or hold a certificate past its rotation. */
const CERT_CACHE_MAX = 8;
const CERT_CACHE_TTL_MS = 60 * 60 * 1000;
const certCache = new Map<string, { pem: string; at: number }>();

/**
 * Only SNS's own signing hosts are trusted.
 *
 * A suffix match on amazonaws.com is not enough: anyone can host a .pem on
 * s3.amazonaws.com and would then be able to sign notifications we accept.
 * The host must be an SNS endpoint specifically.
 */
export function certUrlIsTrusted(url: string): boolean {
  try {
    const parsed = new URL(url);
    return (
      parsed.protocol === "https:" &&
      /^sns\.[a-z0-9-]+\.amazonaws\.com$/.test(parsed.hostname) &&
      parsed.pathname.endsWith(".pem")
    );
  } catch {
    return false;
  }
}

/** SubscribeURL is fetched by us, so it must be pinned the same way. */
export function subscribeUrlIsTrusted(url: string): boolean {
  try {
    const parsed = new URL(url);
    return (
      parsed.protocol === "https:" &&
      /^sns\.[a-z0-9-]+\.amazonaws\.com$/.test(parsed.hostname)
    );
  } catch {
    return false;
  }
}

async function fetchCertificate(url: string): Promise<string | null> {
  const cached = certCache.get(url);
  if (cached && Date.now() - cached.at < CERT_CACHE_TTL_MS) return cached.pem;
  const res = await fetch(url, { signal: AbortSignal.timeout(10_000) });
  if (!res.ok) return null;
  const pem = (await res.text()).slice(0, 16_384);
  if (certCache.size >= CERT_CACHE_MAX) {
    const oldest = certCache.keys().next().value;
    if (oldest) certCache.delete(oldest);
  }
  certCache.set(url, { pem, at: Date.now() });
  return pem;
}

function canonicalString(message: SnsEnvelope): string | null {
  // Own-property lookup only: "constructor" or "__proto__" as a Type would
  // otherwise return a function from the prototype chain and throw later.
  if (!Object.prototype.hasOwnProperty.call(SIGNABLE_KEYS, message.Type)) return null;
  const keys = SIGNABLE_KEYS[message.Type];
  if (!Array.isArray(keys)) return null;
  const parts: string[] = [];
  for (const key of keys) {
    const value = (message as unknown as Record<string, string | undefined>)[key];
    if (value === undefined || value === null) continue;
    parts.push(key, value);
  }
  return `${parts.join("\n")}\n`;
}

export async function verifySnsMessage(message: SnsEnvelope): Promise<boolean> {
  const certUrl = message.SigningCertURL ?? message.SigningCertUrl;
  if (!certUrl || !certUrlIsTrusted(certUrl)) return false;
  const payload = canonicalString(message);
  if (!payload) return false;
  const pem = await fetchCertificate(certUrl);
  if (!pem) return false;
  // Allowlist: an unknown version must not silently fall back to SHA-1.
  if (message.SignatureVersion !== "1" && message.SignatureVersion !== "2") return false;
  const algorithm = message.SignatureVersion === "2" ? "RSA-SHA256" : "RSA-SHA1";
  try {
    const verifier = createVerify(algorithm);
    verifier.update(payload, "utf8");
    return verifier.verify(pem, message.Signature, "base64");
  } catch {
    return false;
  }
}

/** SES event payloads we care about, whether from event publishing or receipt. */
export interface SesNotification {
  notificationType?: string;
  eventType?: string;
  mail?: {
    messageId?: string;
    source?: string;
    destination?: string[];
    commonHeaders?: { from?: string[]; to?: string[]; subject?: string; messageId?: string };
  };
  bounce?: {
    bounceType?: string;
    bounceSubType?: string;
    bouncedRecipients?: { emailAddress: string; diagnosticCode?: string }[];
  };
  complaint?: {
    complainedRecipients?: { emailAddress: string }[];
    complaintFeedbackType?: string;
  };
  receipt?: { recipients?: string[]; action?: { type?: string; objectKey?: string } };
  content?: string;
}
