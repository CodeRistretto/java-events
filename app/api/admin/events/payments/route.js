import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { requireAdmin } from "@/lib/adminAuth";
import { logAdminAction } from "@/lib/adminAudit";
import {
  getEventFinancialSummary,
  summarizeEventPayments,
} from "@/lib/eventPayments";

export const dynamic = "force-dynamic";

function fail(error) {
  const status =
    error?.status ||
    (error?.message === "UNAUTHORIZED" ? 401 : 500);

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

async function loadBooking(bookingId) {
  const { data, error } = await supabaseAdmin
    .from("bookings")
    .select(`
      id,
      event_order_number,
      status,
      total,
      total_cents,
      deposit,
      deposit_cents,
      balance,
      balance_cents,
      shopify_order_id,
      shopify_balance_draft_order_id,
      shopify_balance_order_id
    `)
    .eq("id", bookingId)
    .maybeSingle();

  if (error) throw error;

  if (!data) {
    const err = new Error("Evento no encontrado.");
    err.status = 404;
    throw err;
  }

  return data;
}

async function addTimeline({
  bookingId,
  eventType,
  title,
  description = null,
  actor,
  metadata = {},
}) {
  const { error } = await supabaseAdmin
    .from("event_timeline")
    .insert({
      booking_id: bookingId,
      event_type: eventType,
      title,
      description,
      actor,
      metadata,
    });

  if (error) throw error;
}

function publicPayment(payment) {
  return {
    id: payment.id,
    provider: payment.provider,
    providerPaymentId: payment.provider_payment_id,
    paymentMethod: payment.payment_method,
    amount: Number(payment.amount_cents || 0) / 100,
    amountCents: Number(payment.amount_cents || 0),
    status: payment.status,
    paymentType: payment.payment_type,
    reference: payment.reference,
    notes: payment.notes,
    recordedBy: payment.recorded_by,
    paidAt: payment.paid_at,
    createdAt: payment.created_at,
    voidedAt: payment.voided_at,
    voidedBy: payment.voided_by,
    checkoutUrl: payment.raw_snapshot?.invoiceUrl || null,
  };
}

export async function GET(request) {
  try {
    requireAdmin(request);

    const url = new URL(request.url);
    const bookingId = url.searchParams.get("bookingId");

    if (!bookingId) {
      return Response.json(
        { success: false, error: "Falta bookingId." },
        { status: 400 }
      );
    }

    const booking = await loadBooking(bookingId);
    const { payments, summary } = await getEventFinancialSummary(booking);

    return Response.json({
      success: true,
      booking: {
        id: booking.id,
        eventOrderNumber: booking.event_order_number,
        status: booking.status,
        shopifyOrderId: booking.shopify_order_id,
        shopifyBalanceDraftOrderId: booking.shopify_balance_draft_order_id,
        shopifyBalanceOrderId: booking.shopify_balance_order_id,
      },
      summary,
      payments: payments.map(publicPayment),
    });
  } catch (error) {
    return fail(error);
  }
}

export async function POST(request) {
  try {
    const admin = requireAdmin(request);
    const body = await request.json();
    const action = body.action;
    const payload = body.payload || {};

    if (action === "REGISTER_MANUAL_PAYMENT") {
      const booking = await loadBooking(payload.bookingId);
      const { payments, summary } = await getEventFinancialSummary(booking);

      const amountCents = Math.round(Number(payload.amount || 0) * 100);

      if (!Number.isFinite(amountCents) || amountCents <= 0) {
        return Response.json(
          { success: false, error: "El monto debe ser mayor a cero." },
          { status: 400 }
        );
      }

      if (amountCents > summary.remainingCents) {
        return Response.json(
          {
            success: false,
            error: `El pago excede el saldo pendiente de $${summary.remaining.toFixed(
              2
            )} MXN.`,
          },
          { status: 409 }
        );
      }

      const method = String(payload.paymentMethod || "OTHER")
        .trim()
        .toUpperCase();

      const paymentType =
        amountCents === summary.remainingCents ? "BALANCE" : "PARTIAL";

      const { data: payment, error } = await supabaseAdmin
        .from("event_payments")
        .insert({
          booking_id: booking.id,
          provider: "MANUAL",
          provider_payment_id: null,
          payment_method: method,
          amount_cents: amountCents,
          status: "PAID",
          payment_type: paymentType,
          reference: payload.reference?.trim() || null,
          notes: payload.notes?.trim() || null,
          recorded_by: admin.username,
          paid_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          raw_snapshot: {
            source: "ADMIN_MANUAL_PAYMENT",
          },
        })
        .select("*")
        .single();

      if (error) throw error;

      await addTimeline({
        bookingId: booking.id,
        eventType: "PAYMENT_RECORDED",
        title: `Pago registrado: $${(amountCents / 100).toFixed(2)} MXN`,
        description: `${method}${
          payload.reference ? ` · ${payload.reference}` : ""
        }`,
        actor: admin.username,
        metadata: {
          payment_id: payment.id,
          payment_type: paymentType,
          amount_cents: amountCents,
          method,
        },
      });

      await logAdminAction({
        adminId: admin.username,
        action,
        entityType: "event_payments",
        entityId: payment.id,
        oldValue: null,
        newValue: payment,
      });

      const nextSummary = summarizeEventPayments(booking, [
        ...payments,
        payment,
      ]);

      return Response.json({
        success: true,
        payment: publicPayment(payment),
        summary: nextSummary,
      });
    }

    if (action === "VOID_MANUAL_PAYMENT") {
      const { data: payment, error: readError } = await supabaseAdmin
        .from("event_payments")
        .select("*")
        .eq("id", payload.paymentId)
        .maybeSingle();

      if (readError) throw readError;

      if (!payment) {
        return Response.json(
          { success: false, error: "Pago no encontrado." },
          { status: 404 }
        );
      }

      if (payment.provider !== "MANUAL") {
        return Response.json(
          {
            success: false,
            error:
              "Los pagos de Shopify no se anulan desde aquí. Usa el flujo de refund correspondiente.",
          },
          { status: 409 }
        );
      }

      if (payment.status !== "PAID") {
        return Response.json(
          { success: false, error: "Ese pago ya no está activo." },
          { status: 409 }
        );
      }

      const { data: updated, error } = await supabaseAdmin
        .from("event_payments")
        .update({
          status: "VOID",
          voided_at: new Date().toISOString(),
          voided_by: admin.username,
          updated_at: new Date().toISOString(),
        })
        .eq("id", payment.id)
        .select("*")
        .single();

      if (error) throw error;

      await addTimeline({
        bookingId: payment.booking_id,
        eventType: "PAYMENT_VOIDED",
        title: `Pago manual anulado: $${(
          Number(payment.amount_cents || 0) / 100
        ).toFixed(2)} MXN`,
        description: payload.reason?.trim() || null,
        actor: admin.username,
        metadata: {
          payment_id: payment.id,
        },
      });

      await logAdminAction({
        adminId: admin.username,
        action,
        entityType: "event_payments",
        entityId: payment.id,
        oldValue: payment,
        newValue: updated,
      });

      const booking = await loadBooking(payment.booking_id);
      const { payments, summary } = await getEventFinancialSummary(booking);

      return Response.json({
        success: true,
        payment: publicPayment(updated),
        summary,
        payments: payments.map(publicPayment),
      });
    }

    return Response.json(
      { success: false, error: "Acción no soportada." },
      { status: 400 }
    );
  } catch (error) {
    return fail(error);
  }
}
