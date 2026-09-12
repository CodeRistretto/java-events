const ATTRIBUTION_KEY = "java_events_attribution_v1";
const EVENT_COUNTER_KEY = "java_events_event_counters_v1";

const TRACKING_KEYS = [
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_content",
  "utm_term",
  "fbclid",
  "fbc",
  "fbp",
  "gclid",
  "gbraid",
  "wbraid",
  "ttclid",
  "test_event_code",
];

function readJson(key, fallback) {
  try {
    return JSON.parse(window.sessionStorage.getItem(key) || "") || fallback;
  } catch {
    return fallback;
  }
}

function safeValue(value, maxLength = 500) {
  const normalized = String(value || "").trim();
  return normalized ? normalized.slice(0, maxLength) : null;
}

function createSessionId() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return `jev-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function deriveFbc(fbclid) {
  return fbclid ? `fb.1.${Date.now()}.${fbclid}` : null;
}

export function initializeAttribution() {
  if (typeof window === "undefined") return {};

  const current = readJson(ATTRIBUTION_KEY, {});
  const params = new URLSearchParams(window.location.search);
  const next = { ...current };

  for (const key of TRACKING_KEYS) {
    const value = safeValue(params.get(key));
    if (value) next[key] = value;
  }

  if (!next.client_session_id) next.client_session_id = createSessionId();
  if (!next.fbc && next.fbclid) next.fbc = deriveFbc(next.fbclid);
  if (!next.landing_page) {
    next.landing_page = safeValue(
      params.get("landing_page") || window.location.href.split("#")[0],
      2000
    );
  }
  if (!next.referrer) {
    next.referrer = safeValue(params.get("referrer") || document.referrer, 2000);
  }
  if (!next.captured_at) next.captured_at = new Date().toISOString();

  window.sessionStorage.setItem(ATTRIBUTION_KEY, JSON.stringify(next));
  return next;
}

export function getAttribution() {
  return initializeAttribution();
}

export function nextTrackingEventId(eventName) {
  if (typeof window === "undefined") return null;

  const attribution = initializeAttribution();
  const counters = readJson(EVENT_COUNTER_KEY, {});
  const count = Number(counters[eventName] || 0) + 1;
  counters[eventName] = count;
  window.sessionStorage.setItem(EVENT_COUNTER_KEY, JSON.stringify(counters));

  return `java-${eventName.toLowerCase()}-${attribution.client_session_id}-${count}`;
}

export function postParentTracking(eventName, customData = {}) {
  if (typeof window === "undefined" || window.parent === window) return;

  window.parent.postMessage(
    {
      type: "JAVA_EVENTS_TRACK",
      eventName,
      customData,
    },
    "*"
  );
}
