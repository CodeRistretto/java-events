import {
  normalizeAttribution,
  requestContext,
  sendMetaConversion,
} from "@/lib/metaConversions";

export const runtime = "nodejs";

const ALLOWED_EVENTS = new Set(["JavaQuoteStarted"]);

export async function POST(request) {
  try {
    const body = await request.json();
    const eventName = String(body.eventName || "");

    if (!ALLOWED_EVENTS.has(eventName)) {
      return Response.json({ success: false, error: "Unsupported event" }, { status: 400 });
    }

    const attribution = normalizeAttribution(body.attribution);
    const eventId = String(body.eventId || "").slice(0, 200);

    if (!eventId || !attribution.client_session_id) {
      return Response.json({ success: false, error: "Missing event identity" }, { status: 400 });
    }

    const delivery = await sendMetaConversion({
      eventName,
      eventId,
      eventSourceUrl: attribution.landing_page,
      attribution,
      context: requestContext(request),
      customer: { externalId: attribution.client_session_id },
      customData: {
        content_name: "Java Coffee Cart",
        content_category: "Event service",
        currency: "MXN",
      },
    });

    return Response.json({ success: true, delivery });
  } catch (error) {
    console.error("Meta tracking API error", error);
    return Response.json({ success: false }, { status: 202 });
  }
}

