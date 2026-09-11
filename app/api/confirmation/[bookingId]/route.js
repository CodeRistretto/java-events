import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";

function centsToMoney(cents) {
  return Number(cents || 0) / 100;
}

export async function GET(request, context) {
  try {
    const params = await context.params;
    const bookingId = params?.bookingId;

    if (!bookingId) {
      return Response.json(
        {
          success: false,
          error: "Falta el identificador del evento.",
        },
        { status: 400 }
      );
    }

    const {
      data: booking,
      error: bookingError,
    } = await supabaseAdmin
      .from("bookings")
      .select(`
        id,
        event_order_number,
        confirmation_number,
        status,
        customer_name,
        event_type,
        city,
        state,
        venue_name,
        event_address,
        neighborhood,
        postal_code,
        event_date,
        start_time,
        duration_hours,
        guests,
        total,
        deposit,
        balance,
        total_cents,
        deposit_cents,
        balance_cents,
        pricing_snapshot,
        shopify_order_id,
        created_at,
        confirmed_at
      `)
      .eq("id", bookingId)
      .maybeSingle();

    if (bookingError) {
      throw bookingError;
    }

    if (!booking) {
      return Response.json(
        {
          success: false,
          error: "No encontramos este evento.",
        },
        { status: 404 }
      );
    }

    const {
      data: items,
      error: itemsError,
    } = await supabaseAdmin
      .from("event_order_items")
      .select(`
        id,
        item_type,
        item_code,
        item_name,
        pricing_type,
        quantity,
        unit_price_cents,
        line_total_cents,
        created_at
      `)
      .eq("booking_id", bookingId)
      .order("created_at", {
        ascending: true,
      });

    if (itemsError) {
      throw itemsError;
    }

    const snapshot =
      booking.pricing_snapshot || {};

    const total =
      booking.total_cents !== null &&
      booking.total_cents !== undefined
        ? centsToMoney(booking.total_cents)
        : Number(booking.total || 0);

    const deposit =
      booking.deposit_cents !== null &&
      booking.deposit_cents !== undefined
        ? centsToMoney(booking.deposit_cents)
        : Number(booking.deposit || 0);

    const balance =
      booking.balance_cents !== null &&
      booking.balance_cents !== undefined
        ? centsToMoney(booking.balance_cents)
        : Number(booking.balance || 0);

    const subtotal =
      snapshot.subtotalCents !== undefined
        ? centsToMoney(snapshot.subtotalCents)
        : null;

    const vat =
      snapshot.vatCents !== undefined
        ? centsToMoney(snapshot.vatCents)
        : null;

    const vatPercent =
      snapshot.vatBps !== undefined
        ? Number(snapshot.vatBps) / 100
        : null;

    let depositSubtotal = null;
    let depositVat = null;

    if (vatPercent !== null && vatPercent > 0) {
      const rate = vatPercent / 100;

      depositSubtotal =
        Math.round(
          (deposit / (1 + rate)) * 100
        ) / 100;

      depositVat =
        Math.round(
          (deposit - depositSubtotal) * 100
        ) / 100;
    }

    return Response.json({
      success: true,

      event: {
        id: booking.id,

        number:
          booking.confirmation_number ||
          booking.event_order_number ||
          booking.id,

        orderNumber:
          booking.event_order_number,

        status:
          booking.status,

        customerName:
          booking.customer_name,

        eventType:
          booking.event_type,

        city:
          booking.city,

        state:
          booking.state,

        venueName:
          booking.venue_name,

        address:
          booking.event_address,

        neighborhood:
          booking.neighborhood,

        postalCode:
          booking.postal_code,

        eventDate:
          booking.event_date,

        startTime:
          booking.start_time,

        durationHours:
          booking.duration_hours,

        guests:
          booking.guests,

        subtotal,
        vat,
        vatPercent,

        total,
        deposit,
        balance,

        depositSubtotal,
        depositVat,

        shopifyOrderId:
          booking.shopify_order_id,

        confirmedAt:
          booking.confirmed_at,

        createdAt:
          booking.created_at,
      },

      items:
        (items || []).map((item) => ({
          id: item.id,
          type: item.item_type,
          code: item.item_code,
          name: item.item_name,
          pricingType:
            item.pricing_type,
          quantity:
            Number(item.quantity),
          unitPrice:
            centsToMoney(
              item.unit_price_cents
            ),
          lineTotal:
            centsToMoney(
              item.line_total_cents
            ),
        })),
    });
  } catch (error) {
    console.error(
      "Confirmation API error:",
      error
    );

    return Response.json(
      {
        success: false,
        error:
          error.message ||
          "No fue posible cargar el evento.",
      },
      { status: 500 }
    );
  }
}