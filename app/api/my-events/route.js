import { getEventFinancialSummary } from "@/lib/eventPayments";
import { normalizeMexicoPhone } from "@/lib/phone";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";

function validEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || "").trim());
}

function centsToMoney(cents, legacyValue) {
  if (cents !== null && cents !== undefined) return Number(cents) / 100;
  return Number(legacyValue || 0);
}

export async function POST(request) {
  try {
    const body = await request.json();
    const email = String(body.email || "").trim().toLowerCase();
    const phone = normalizeMexicoPhone(body.phone);

    if (!validEmail(email)) {
      return Response.json(
        {
          success: false,
          error:
            "Ingresa el mismo correo electrónico que utilizaste para reservar.",
        },
        { status: 400 }
      );
    }

    if (!phone) {
      return Response.json(
        {
          success: false,
          error:
            "Ingresa el mismo teléfono mexicano de 10 dígitos que utilizaste para reservar.",
        },
        { status: 400 }
      );
    }

    const { data: bookings, error } = await supabaseAdmin
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
        created_at,
        confirmed_at,
        shopify_order_id,
        shopify_balance_order_id
      `)
      .ilike("email", email)
      .eq("phone", phone)
      .not("event_order_number", "is", null)
      .neq("status", "EXPIRED")
      .order("event_date", { ascending: false })
      .order("created_at", { ascending: false });

    if (error) throw error;

    const events = [];

    for (const booking of bookings || []) {
      const financial = await getEventFinancialSummary(booking);

      events.push({
        id: booking.id,
        number:
          booking.confirmation_number || booking.event_order_number || booking.id,
        orderNumber: booking.event_order_number,
        status: booking.status,
        customerName: booking.customer_name,
        eventType: booking.event_type,
        city: booking.city,
        state: booking.state,
        venueName: booking.venue_name,
        eventDate: booking.event_date,
        startTime: booking.start_time,
        durationHours: booking.duration_hours,
        guests: booking.guests,
        total: centsToMoney(booking.total_cents, booking.total),
        deposit: centsToMoney(booking.deposit_cents, booking.deposit),
        contractedBalance: centsToMoney(booking.balance_cents, booking.balance),
        balance: financial.summary.remaining,
        paidTotal: financial.summary.paid,
        fullyPaid: financial.summary.fullyPaid,
        confirmedAt: booking.confirmed_at,
        createdAt: booking.created_at,
        paid: financial.summary.paidCents > 0,
      });
    }

    return Response.json({
      success: true,
      events,
      count: events.length,
    });
  } catch (error) {
    console.error("My Events API error:", error);

    return Response.json(
      {
        success: false,
        error: error.message || "No fue posible consultar tus eventos.",
      },
      { status: 500 }
    );
  }
}
