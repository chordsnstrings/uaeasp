/**
 * Minimal RFC 5322 reader for inbound replies.
 *
 * SES hands us the raw message; we only need who sent it, what it threads to,
 * and the human-written text. A full MIME library is overkill for that and
 * every dependency here would run in the worker, so this parses the subset we
 * actually see: folded headers, base64/quoted-printable bodies, and
 * multipart/* where we take the text/plain part (falling back to stripped HTML).
 */

export interface ParsedEmail {
  from: string;
  fromName?: string;
  to: string[];
  subject: string;
  messageId?: string;
  inReplyTo?: string;
  references?: string[];
  text: string;
  date?: Date;
}

function unfold(headerBlock: string): string[] {
  return headerBlock
    .replace(/\r\n/g, "\n")
    .split("\n")
    .reduce<string[]>((lines, line) => {
      if (/^[ \t]/.test(line) && lines.length) lines[lines.length - 1] += ` ${line.trim()}`;
      else lines.push(line);
      return lines;
    }, []);
}

function headerValue(lines: string[], name: string): string | undefined {
  const prefix = `${name.toLowerCase()}:`;
  const line = lines.find((l) => l.toLowerCase().startsWith(prefix));
  return line ? line.slice(prefix.length).trim() : undefined;
}

/** Decode RFC 2047 encoded words in a header value. */
export function decodeHeaderWords(value: string): string {
  return value.replace(
    /=\?([^?]+)\?([BbQq])\?([^?]*)\?=/g,
    (_all, charset: string, encoding: string, data: string) => {
      try {
        if (encoding.toUpperCase() === "B") {
          return Buffer.from(data, "base64").toString(
            (charset.toLowerCase() as BufferEncoding) === "utf-8" ? "utf8" : "utf8",
          );
        }
        const bytes = data
          .replace(/_/g, " ")
          .replace(/=([0-9A-Fa-f]{2})/g, (_m, hex: string) =>
            String.fromCharCode(parseInt(hex, 16)),
          );
        return Buffer.from(bytes, "binary").toString("utf8");
      } catch {
        return data;
      }
    },
  );
}

export function decodeQuotedPrintable(input: string): string {
  return Buffer.from(
    input
      .replace(/=\r?\n/g, "")
      .replace(/=([0-9A-Fa-f]{2})/g, (_m, hex: string) =>
        String.fromCharCode(parseInt(hex, 16)),
      ),
    "binary",
  ).toString("utf8");
}

function decodeBody(body: string, encoding?: string): string {
  const enc = (encoding ?? "").toLowerCase();
  if (enc.includes("base64")) {
    return Buffer.from(body.replace(/\s+/g, ""), "base64").toString("utf8");
  }
  if (enc.includes("quoted-printable")) return decodeQuotedPrintable(body);
  return body;
}

export function htmlToText(html: string): string {
  // Inbound mail is attacker-controlled: cap the work before any regex runs.
  return html
    .slice(0, 200_000)
    .replace(/<style\b[^>]*>[^<]*(?:<(?!\/style)[^<]*)*<\/style>/gi, "")
    .replace(/<script\b[^>]*>[^<]*(?:<(?!\/script)[^<]*)*<\/script>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|tr|li|h[1-6])>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function parseAddress(value: string): { email: string; name?: string } {
  const angled = value.match(/<([^>]+)>/);
  if (angled) {
    const name = decodeHeaderWords(value.slice(0, value.indexOf("<")).trim())
      .replace(/^"|"$/g, "")
      .trim();
    return { email: angled[1].trim().toLowerCase(), name: name || undefined };
  }
  return { email: value.trim().toLowerCase() };
}

function splitParts(body: string, boundary: string): string[] {
  return body
    .split(new RegExp(`--${boundary.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?:--)?\\r?\\n?`))
    .slice(1, -1);
}

function extractText(headerLines: string[], body: string): string {
  const contentType = headerValue(headerLines, "content-type") ?? "text/plain";
  const encoding = headerValue(headerLines, "content-transfer-encoding");

  if (/^multipart\//i.test(contentType)) {
    const boundary = contentType.match(/boundary="?([^";]+)"?/i)?.[1];
    if (!boundary) return "";
    const parts = splitParts(body, boundary);
    const decoded = parts.map((part) => {
      const split = part.indexOf("\n\n") >= 0 ? part.indexOf("\n\n") : part.indexOf("\r\n\r\n");
      const partHeaders = unfold(split >= 0 ? part.slice(0, split) : part);
      const partBody = split >= 0 ? part.slice(split).replace(/^\s*\n/, "") : "";
      return { headers: partHeaders, body: partBody };
    });
    const plain = decoded.find((p) =>
      (headerValue(p.headers, "content-type") ?? "text/plain").startsWith("text/plain"),
    );
    if (plain) {
      return decodeBody(plain.body, headerValue(plain.headers, "content-transfer-encoding"));
    }
    const html = decoded.find((p) =>
      (headerValue(p.headers, "content-type") ?? "").startsWith("text/html"),
    );
    if (html) {
      return htmlToText(
        decodeBody(html.body, headerValue(html.headers, "content-transfer-encoding")),
      );
    }
    // Nested multipart (e.g. multipart/mixed wrapping multipart/alternative).
    for (const part of decoded) {
      const nested = extractText(part.headers, part.body);
      if (nested) return nested;
    }
    return "";
  }

  const decoded = decodeBody(body, encoding);
  return contentType.startsWith("text/html") ? htmlToText(decoded) : decoded;
}

export function parseEmail(raw: string): ParsedEmail {
  const normalized = raw.replace(/\r\n/g, "\n");
  const split = normalized.indexOf("\n\n");
  const headerBlock = split >= 0 ? normalized.slice(0, split) : normalized;
  const body = split >= 0 ? normalized.slice(split + 2) : "";
  const lines = unfold(headerBlock);

  const fromRaw = headerValue(lines, "from") ?? "";
  const from = parseAddress(fromRaw);
  const dateRaw = headerValue(lines, "date");
  const parsedDate = dateRaw ? new Date(dateRaw) : undefined;

  return {
    from: from.email,
    fromName: from.name,
    to: (headerValue(lines, "to") ?? "")
      .split(",")
      .map((a) => parseAddress(a).email)
      .filter(Boolean),
    subject: decodeHeaderWords(headerValue(lines, "subject") ?? ""),
    messageId: headerValue(lines, "message-id")?.replace(/[<>]/g, ""),
    inReplyTo: headerValue(lines, "in-reply-to")?.replace(/[<>]/g, ""),
    references: headerValue(lines, "references")
      ?.split(/\s+/)
      .map((r) => r.replace(/[<>]/g, ""))
      .filter(Boolean),
    text: extractText(lines, body).trim(),
    date: parsedDate && !Number.isNaN(parsedDate.getTime()) ? parsedDate : undefined,
  };
}

/**
 * Strip the quoted history so the AI reads only what the human just wrote.
 * Cuts at the first reply separator, signature marker or quote block.
 */
export function stripQuotedReply(text: string): string {
  const lines = text.split("\n");
  const out: string[] = [];
  const cutPatterns = [
    /^On .+ wrote:$/i,
    /^-{2,}\s*Original Message\s*-{2,}$/i,
    /^_{5,}$/,
    /^From:\s.+/i,
    /^Sent from my /i,
    /^في .+ كتب:$/,
  ];
  for (const line of lines) {
    const trimmed = line.trim();
    if (cutPatterns.some((p) => p.test(trimmed))) break;
    if (trimmed === "--" || trimmed === "-- ") break;
    if (trimmed.startsWith(">")) continue;
    out.push(line);
  }
  return out.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}
