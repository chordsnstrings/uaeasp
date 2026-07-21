/** Client-side analytics helpers. First-party, cookieless: a random id in
 * sessionStorage groups a visit; nothing identifies the person. */

const SESSION_KEY = "uae-einv-sid";

export function getSessionId(): string {
  try {
    let sid = sessionStorage.getItem(SESSION_KEY);
    if (!sid) {
      sid = crypto.randomUUID();
      sessionStorage.setItem(SESSION_KEY, sid);
    }
    return sid;
  } catch {
    // Storage blocked — fall back to a per-page id.
    return crypto.randomUUID();
  }
}

interface CollectPayload {
  type: "pageview" | "event";
  name?: string;
  path: string;
  locale?: "en" | "ar";
  referrer?: string;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  screenW?: number;
}

function send(payload: CollectPayload) {
  try {
    const body = JSON.stringify({ ...payload, sessionId: getSessionId() });
    if (navigator.sendBeacon) {
      navigator.sendBeacon("/api/collect", new Blob([body], { type: "application/json" }));
    } else {
      void fetch("/api/collect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
        keepalive: true,
      });
    }
  } catch {
    // Never let analytics throw into the app.
  }
}

export function trackPageview(path: string, locale: "en" | "ar") {
  const sp = new URLSearchParams(window.location.search);
  send({
    type: "pageview",
    path,
    locale,
    referrer: document.referrer || undefined,
    utmSource: sp.get("utm_source") ?? undefined,
    utmMedium: sp.get("utm_medium") ?? undefined,
    utmCampaign: sp.get("utm_campaign") ?? undefined,
    screenW: window.innerWidth,
  });
}

/** Named conversion/interaction event (e.g. lead_submitted, quiz_completed). */
export function track(name: string, path?: string) {
  send({
    type: "event",
    name,
    path: path ?? window.location.pathname,
    screenW: window.innerWidth,
  });
}
