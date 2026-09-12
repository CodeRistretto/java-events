import crypto from "node:crypto";

import { supabaseAdmin } from "@/lib/supabaseAdmin";

const META_API_VERSION = "v26.0";

function clean(value, maxLength = 500) {
  const normalized = String(value || "").trim();
  return normalized ? normalized.slice(0, maxLength) : null;
}

function hash(value) {
  const normalized = clean(value)?.toLowerCase();
  return normalized
    ? crypto.createHash("sha256").update(normalized).digest("hex")
    : null;
}

function digits(value) {
  return clean(value)?.replace(/\D/g, "") || null;
}

function splitName(value) {
  const parts = clean(value)?.toLowerCase().split(/\s+/).filter(Boolean) || [];
  return {
    firstName: parts[0] || null,
    lastName: parts.slice(1).join(" ") || null,
  };
}

function safeUrl(value) {
  try {
    const url = new URL(String(value || ""));
    return ["http:", "https:"].includes(url.protocol) ? url.toString() : null;
  } catch {
    return null;
  }
}

export function normalizeAttribution(value = {}) {
  return {
    utm_source: clean(value.utm_source),
    utm_medium: clean(value.utm_medium),
    utm_campaign: clean(value.utm_campaign),
    utm_content: clean(value.utm_content),
    utm_term: clean(value.utm_term),
    fbclid: clean(value.fbclid),
    fbc: clean(value.fbc),
    fbp: clean(value.fbp),
    gclid: clean(value.gclid),
    gbraid: clean(value.gbraid),
    wbraid: clean(value.wbraid),
    ttclid: clean(value.ttclid),
    test_event_code: clean(value.test_event_code, 100),
    landing_page: safeUrl(value.landing_page),
    referrer: safeUrl(value.referrer),
    client_session_id: clean(value.client_session_id),
    captured_at: clean(value.captured_at),
  };
}

export function requestContext(request) {
  const forwarded = request.headers.get("x-forwarded-for");
  return {
    clientIpAddress: clean(forwarded?.split(",")[0]),
    clientUserAgent: clean(request.headers.get("user-agent"), 1000),
  };
}

function compact(object) {
  return Object.fromEntries(
    Object.entries(object).filter(([, value]) => value !== null && value !== undefined && value !== "")
  );
}

function buildUserData({ attribution = {}, customer = {}, context = {} }) {
  const normalized = normalizeAttribution(attribution);
  const { firstName, lastName } = splitName(customer.name);
  const phone = digits(customer.phone);

  return compact({
    em: customer.email ? [hash(customer.email)] : undefined,
    ph: phone ? [hash(phone)] : undefined,
    fn: firstName ? [hash(firstName)] : undefined,
    ln: lastName ? [hash(lastName)] : undefined,
    ct: customer.city ? [hash(customer.city)] : undefined,
    st: customer.state ? [hash(customer.state)] : undefined,
    zp: customer.postalCode ? [hash(digits(customer.postalCode))] : undefined,
    country: [hash("mx")],
    external_id: customer.externalId ? [hash(customer.externalId)] : undefined,
    client_ip_address: clean(context.clientIpAddress || customer.clientIpAddress),
    client_user_agent: clean(context.clientUserAgent || customer.clientUserAgent, 1000),
    fbc: normalized.fbc,
    fbp: normalized.fbp,
  });
}

export async function sendMetaConversion({
  eventName,
  eventId,
  eventSourceUrl,
  eventTime = Math.floor(Date.now() / 1000),
  attribution = {},
  customer = {},
  context = {},
  customData = {},
}) {
  const datasetId = clean(process.env.META_DATASET_ID);
  const accessToken = clean(process.env.META_CAPI_ACCESS_TOKEN, 10000);

  if (!datasetId || !accessToken) {
    return { skipped: true, reason: "Meta CAPI environment is not configured" };
  }

  const normalized = normalizeAttribution(attribution);
  const sourceUrl = safeUrl(eventSourceUrl || normalized.landing_page);
  const userData = buildUserData({ attribution: normalized, customer, context });

  if (!eventName || !eventId || !sourceUrl) {
    throw new Error("Meta CAPI event_name, event_id and event_source_url are required.");
  }

  const payload = {
    data: [
      {
        event_name: clean(eventName, 100),
        event_time: Number(eventTime),
        event_id: clean(eventId, 200),
        action_source: "website",
        event_source_url: sourceUrl,
        user_data: userData,
        custom_data: compact(customData),
      },
    ],
  };

  const testEventCode = normalized.test_event_code || process.env.META_CAPI_TEST_EVENT_CODE;
  if (testEventCode) {
    payload.test_event_code = clean(testEventCode, 100);
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 7000);

  try {
    const response = await fetch(
      `https://graph.facebook.com/${META_API_VERSION}/${encodeURIComponent(datasetId)}/events?access_token=${encodeURIComponent(accessToken)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        signal: controller.signal,
      }
    );

    const result = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(
        clean(result?.error?.message, 1000) || `Meta CAPI returned HTTP ${response.status}`
      );
    }

    return { skipped: false, result };
  } finally {
    clearTimeout(timeout);
  }
}

export async function deliverMetaConversion({ bookingId = null, paymentId = null, ...event }) {
  const eventId = clean(event.eventId, 200);
  if (!eventId) throw new Error("A Meta delivery requires an event ID.");

  let delivery = null;
  const { data: existing, error: existingError } = await supabaseAdmin
    .from("event_conversion_deliveries")
    .select("id,status,attempts")
    .eq("event_id", eventId)
    .maybeSingle();

  if (existingError) throw existingError;
  if (existing?.status === "SENT") return { skipped: true, reason: "Already delivered" };

  if (existing) {
    delivery = existing;
  } else {
    const { data: inserted, error: insertError } = await supabaseAdmin
      .from("event_conversion_deliveries")
      .insert({
        booking_id: bookingId,
        payment_id: paymentId,
        provider: "META",
        event_name: event.eventName,
        event_id: eventId,
        status: "PENDING",
        request_snapshot: {
          event_name: event.eventName,
          event_source_url: event.eventSourceUrl,
          custom_data: event.customData,
        },
      })
      .select("id,status,attempts")
      .single();

    if (insertError?.code === "23505") {
      const { data: raced, error: racedError } = await supabaseAdmin
        .from("event_conversion_deliveries")
        .select("id,status,attempts")
        .eq("event_id", eventId)
        .single();
      if (racedError) throw racedError;
      delivery = raced;
    } else if (insertError) {
      throw insertError;
    } else {
      delivery = inserted;
    }
  }

  if (delivery.status === "SENT") return { skipped: true, reason: "Already delivered" };

  await supabaseAdmin
    .from("event_conversion_deliveries")
    .update({
      status: "PENDING",
      attempts: Number(delivery.attempts || 0) + 1,
      last_error: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", delivery.id);

  try {
    const result = await sendMetaConversion(event);
    const status = result.skipped ? "SKIPPED" : "SENT";
    await supabaseAdmin
      .from("event_conversion_deliveries")
      .update({
        status,
        response_snapshot: result,
        sent_at: result.skipped ? null : new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", delivery.id);
    return result;
  } catch (error) {
    await supabaseAdmin
      .from("event_conversion_deliveries")
      .update({
        status: "FAILED",
        last_error: clean(error.message, 2000),
        updated_at: new Date().toISOString(),
      })
      .eq("id", delivery.id);
    throw error;
  }
}
