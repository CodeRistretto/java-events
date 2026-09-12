import { requireAdmin } from "@/lib/adminAuth";
import { getEventFinancialSummary } from "@/lib/eventPayments";
import { ensureAutomatedBalanceDraft } from "@/lib/shopifyBalanceAuto";
import { sendDraftOrderInvoiceEmail } from "@/lib/shopifyInvoiceEmail";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";

function fail(error) {
  const status = error?.status || (error?.message === "UNAUTHORIZED" ? 401 : 500);
  return Response.json(
    {
      success: false,
      error:
        error?.message === "UNAUTHORIZED"
          ? "Unauthorized"
          : error?.message || "Error inesperado.",
    },
    { status }
  );
}

export async function GET(request) {
  try {
    requireAdmin(request);

    const today = new Date().toISOString().slice(0, 10);

    const [logsResult, settingsResult, upcomingResult] = await Promise.all([
      supabaseAdmin
        .from("event_email_log")
        .select("*")
        .order("sent_at", { ascending: false })
        .limit(100),
      supabaseAdmin
        .from("event_settings")
        .select("balance_due_days_before")
        .eq("id", 1)
        .single(),
      supabaseAdmin
        .from("bookings")
        .select("*")
        .in("status", ["CONFIRMED", "PREPARATION"])
        .not("shopify_order_id", "is", null)
        .gte("event_date", today)
        .order("event_date", { ascending: true })
        .limit(40),
    ]);

    if (logsResult.error) throw logsResult.error;
    if (settingsResult.error) throw settingsResult.error;
    if (upcomingResult.error) throw upcomingResult.error;

    const logIds = [...new Set((logsResult.data || []).map((item) => item.booking_id))];
    let logBookings = [];

    if (logIds.length) {
      const result = await supabaseAdmin
        .from("bookings")
        .select("id,event_order_number,customer_name,email,event_date,status")
        .in("id", logIds);
      if (result.error) throw result.error;
      logBookings = result.data || [];
    }

    const bookingMap = Object.fromEntries(
      logBookings.map((item) => [item.id, item])
    );

    const upcoming = [];
    for (const booking of upcomingResult.data || []) {
      const { summary } = await getEventFinancialSummary(booking);
      if (summary.remainingCents <= 0) continue;
      upcoming.push({
        id: booking.id,
        eventOrderNumber: booking.event_order_number,
        customerName: booking.customer_name,
        email: booking.email,
        eventDate: booking.event_date,
        paymentDeadlineAt: booking.payment_deadline_at,
        remaining: summary.remaining,
        remainingCents: summary.remainingCents,
      });
    }

    return Response.json({
      success: true,
      settings: settingsResult.data,
      upcoming,
      logs: (logsResult.data || []).map((item) => ({
        ...item,
        booking: bookingMap[item.booking_id] || null,
      })),
    });
  } catch (error) {
    return fail(error);
  }
}

export async function POST(request) {
  try {
    const admin = requireAdmin(request);
    const body = await request.json();

    if (body.action !== "SEND_TEST_REMINDER") {
      return Response.json(
        { success: false, error: "Acción no soportada." },
        { status: 400 }
      );
    }

    const bookingId = body.bookingId;
    if (!bookingId) {
      return Response.json(
        { success: false, error: "Selecciona un evento." },
        { status: 400 }
      );
    }

    const { data: booking, error } = await supabaseAdmin
      .from("bookings")
      .select("*")
      .eq("id", bookingId)
      .maybeSingle();
    if (error) throw error;
    if (!booking) {
      return Response.json(
        { success: false, error: "Evento no encontrado." },
        { status: 404 }
      );
    }

    const { summary } = await getEventFinancialSummary(booking);
    if (summary.remainingCents <= 0) {
      return Response.json(
        { success: false, error: "Este evento ya está liquidado." },
        { status: 409 }
      );
    }

    const draft = await ensureAutomatedBalanceDraft(booking);
    if (draft.alreadyPaid) {
      return Response.json(
        { success: false, error: "Este evento ya está liquidado." },
        { status: 409 }
      );
    }

    const baseUrl = process.env.APP_BASE_URL || "http://localhost:3000";
    const eventRef = booking.event_order_number || booking.id;
    const subject = `Prueba de recordatorio Java Events · ${eventRef}`;
    const customMessage =
      `Esta es una prueba del sistema automático de Java Events. ` +
      `Saldo pendiente: $${summary.remaining.toFixed(2)} MXN. ` +
      `La factura incluye el botón seguro de Shopify para pagar el saldo. ` +
      `Confirmación del evento: ${baseUrl}/confirmation/${booking.id}`;

    const sent = await sendDraftOrderInvoiceEmail({
      draftOrderId: draft.draftOrderId,
      to: booking.email,
      subject,
      customMessage,
    });

    const reminderKey = `TEST_${Date.now()}`;
    const { error: logError } = await supabaseAdmin
      .from("event_email_log")
      .insert({
        booking_id: booking.id,
        reminder_key: reminderKey,
        email_type: "SHOPIFY_BALANCE_INVOICE_TEST",
        recipient: booking.email,
        subject,
        shopify_draft_order_id: draft.draftOrderId,
        invoice_url: sent.invoiceUrl || draft.invoiceUrl,
        sent_at: sent.invoiceSentAt || new Date().toISOString(),
        metadata: {
          manual_test: true,
          remaining_cents: summary.remainingCents,
          sent_by: admin.username,
        },
      });
    if (logError) throw logError;

    await supabaseAdmin.from("event_timeline").insert({
      booking_id: booking.id,
      event_type: "BALANCE_REMINDER_TEST_SENT",
      title: "Prueba de recordatorio Shopify enviada",
      description: subject,
      actor: admin.username,
      metadata: {
        draft_order_id: draft.draftOrderId,
        remaining_cents: summary.remainingCents,
      },
    });

    return Response.json({
      success: true,
      recipient: booking.email,
      subject,
      invoiceUrl: sent.invoiceUrl || draft.invoiceUrl,
    });
  } catch (error) {
    return fail(error);
  }
}
