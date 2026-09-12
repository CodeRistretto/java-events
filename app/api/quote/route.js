import { calculateEventQuote, centsToMoney } from "@/lib/eventPricing";
import {
  normalizeAttribution,
  requestContext,
  sendMetaConversion,
} from "@/lib/metaConversions";

function minutesFromTime(value) {
  if (!value) return null;
  const [hour, minute] = String(value).split(":").map(Number);
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return null;
  return hour * 60 + minute;
}

function deriveDurationHours(body) {
  const start = minutesFromTime(body.startTime);
  const end = minutesFromTime(body.endTime);

  if (start !== null && end !== null && end > start) {
    return (end - start) / 60;
  }

  const supplied = Number(body.durationHours);
  return Number.isFinite(supplied) && supplied > 0 ? supplied : null;
}

export async function POST(request) {
  try {
    const body = await request.json();
    const durationHours = deriveDurationHours(body);

    const quote = await calculateEventQuote({
      serviceAreaId: body.serviceAreaId,
      guestCount: Number(body.guestCount ?? body.guests),
      selectedAddOns: Array.isArray(body.selectedAddOns) ? body.selectedAddOns : [],
      paymentChoice: body.paymentChoice || null,
      durationHours,
    });

    const attribution = normalizeAttribution(body.attribution);
    if (body.trackingEventId && attribution.client_session_id) {
      try {
        await sendMetaConversion({
          eventName: "JavaQuoteGenerated",
          eventId: String(body.trackingEventId).slice(0, 200),
          eventSourceUrl: attribution.landing_page,
          attribution,
          context: requestContext(request),
          customer: { externalId: attribution.client_session_id },
          customData: {
            content_name: "Java Coffee Cart",
            content_category: "Event service quote",
            value: Number(centsToMoney(quote.totalCents)),
            currency: "MXN",
            deposit_value: Number(centsToMoney(quote.depositCents)),
            guest_count: quote.guestCount,
            event_type: String(body.eventType || ""),
            event_city: quote.serviceArea.city,
          },
        });
      } catch (trackingError) {
        console.error("JavaQuoteGenerated Meta tracking error", trackingError);
      }
    }

    return Response.json({
      success: true,
      quote: {
        ...quote,
        ratePerGuest: centsToMoney(quote.ratePerGuestCents),
        baseSubtotal: centsToMoney(quote.baseSubtotalCents),
        addOnsTotal: centsToMoney(quote.addOnsTotalCents),
        transportFee: centsToMoney(quote.transportFeeCents),
        transportNet: centsToMoney(quote.transportNetCents),
        transportVat: centsToMoney(quote.transportVatCents),
        subtotal: centsToMoney(quote.subtotalCents),
        vat: centsToMoney(quote.vatCents),
        total: centsToMoney(quote.totalCents),
        deposit: centsToMoney(quote.depositCents),
        balance: centsToMoney(quote.balanceCents),
        items: quote.items.map((item) => ({
          ...item,
          unitPrice: centsToMoney(item.unitPriceCents),
          lineTotal: centsToMoney(item.lineTotalCents),
          vatInclusiveLineTotal:
            item.vatInclusiveLineTotalCents === undefined
              ? null
              : centsToMoney(item.vatInclusiveLineTotalCents),
        })),
      },
      serviceArea: quote.serviceArea,
    });
  } catch (error) {
    return Response.json(
      {
        success: false,
        error: error.message || "No fue posible calcular la cotización.",
      },
      { status: 400 }
    );
  }
}
