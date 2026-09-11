import crypto from "crypto";

import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

function verifyShopifyWebhook(rawBody, receivedHmac) {
  const secret = process.env.SHOPIFY_CLIENT_SECRET;
  if (!secret || !receivedHmac) return false;

  const calculatedHmac = crypto
    .createHmac("sha256", secret)
    .update(rawBody, "utf8")
    .digest("base64");

  const receivedBuffer = Buffer.from(receivedHmac, "utf8");
  const calculatedBuffer = Buffer.from(calculatedHmac, "utf8");

  if (receivedBuffer.length !== calculatedBuffer.length) return false;

  return crypto.timingSafeEqual(receivedBuffer, calculatedBuffer);
}

function getAttribute(payload, wantedName) {
  const attributes = payload.note_attributes || [];

  for (const attribute of attributes) {
    const name = attribute.name || attribute.key;
    if (name === wantedName) {
      return String(attribute.value || "").trim() || null;
    }
  }

  return null;
}

function moneyToCents(value) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.round(number * 100) : 0;
}

function paymentMethod(payload) {
  const gateways = payload.payment_gateway_names;

  if (Array.isArray(gateways) && gateways.length) {
    return gateways.join(", ");
  }

  return payload.gateway || "SHOPIFY";
}

async function addTimeline({
  bookingId,
  eventType,
  title,
  description = null,
  metadata = {},
}) {
  const { error } = await supabaseAdmin.from("event_timeline").insert({
    booking_id: bookingId,
    event_type: eventType,
    title,
    description,
    actor: "shopify",
    metadata,
  });

  if (error) throw error;
}

export async function POST(request) {
  try {
    const rawBody = await request.text();
    const receivedHmac = request.headers.get("x-shopify-hmac-sha256");
    const webhookId = request.headers.get("x-shopify-webhook-id");
    const topic = request.headers.get("x-shopify-topic");
    const shop = request.headers.get("x-shopify-shop-domain");

    if (!verifyShopifyWebhook(rawBody, receivedHmac)) {
      console.error("Invalid Shopify webhook HMAC", {
        webhookId,
        topic,
        shop,
      });

      return new Response("Unauthorized", { status: 401 });
    }

    let payload;

    try {
      payload = JSON.parse(rawBody);
    } catch {
      return new Response("Invalid JSON", { status: 400 });
    }

    const bookingId = getAttribute(payload, "java_booking_id");

    if (!bookingId) {
      console.warn("Paid Shopify order without Java booking ID", {
        webhookId,
        orderId: payload.id,
        orderName: payload.name,
      });

      return new Response("Ignored", { status: 200 });
    }

    const paymentId = getAttribute(payload, "java_payment_id");
    const paymentType = (
      getAttribute(payload, "payment_type") || "DEPOSIT"
    ).toUpperCase();

    const shopifyOrderId =
      payload.admin_graphql_api_id ||
      (payload.id ? `gid://shopify/Order/${payload.id}` : null);

    if (!shopifyOrderId) {
      return new Response("Missing Shopify order ID", { status: 400 });
    }

    const { data: booking, error: bookingError } = await supabaseAdmin
      .from("bookings")
      .select(`
        id,
        event_order_number,
        status,
        total,
        total_cents,
        deposit,
        deposit_cents,
        shopify_order_id,
        shopify_balance_order_id,
        confirmed_at
      `)
      .eq("id", bookingId)
      .maybeSingle();

    if (bookingError) throw bookingError;

    if (!booking) {
      console.error("Java booking not found for paid order", {
        bookingId,
        shopifyOrderId,
        webhookId,
      });

      return new Response("Booking not found", { status: 500 });
    }

    const { data: existingByOrder, error: existingError } = await supabaseAdmin
      .from("event_payments")
      .select("id,status")
      .eq("provider", "SHOPIFY")
      .eq("provider_payment_id", shopifyOrderId)
      .maybeSingle();

    if (existingError) throw existingError;

    if (existingByOrder?.status === "PAID") {
      return new Response("Already processed", { status: 200 });
    }

    const actualAmountCents = moneyToCents(
      payload.current_total_price ?? payload.total_price
    );

    let payment = null;

    if (paymentId) {
      const { data: pending, error: pendingError } = await supabaseAdmin
        .from("event_payments")
        .select("*")
        .eq("id", paymentId)
        .eq("booking_id", booking.id)
        .maybeSingle();

      if (pendingError) throw pendingError;

      if (pending) {
        const { data: updated, error: updatePaymentError } = await supabaseAdmin
          .from("event_payments")
          .update({
            provider: "SHOPIFY",
            provider_payment_id: shopifyOrderId,
            payment_method: paymentMethod(payload),
            amount_cents:
              actualAmountCents > 0
                ? actualAmountCents
                : Number(pending.amount_cents || 0),
            status: "PAID",
            payment_type: paymentType || pending.payment_type,
            reference: payload.name || pending.reference,
            paid_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            raw_snapshot: {
              ...(pending.raw_snapshot || {}),
              orderId: shopifyOrderId,
              orderName: payload.name || null,
              webhookId,
              financialStatus: payload.financial_status || null,
            },
          })
          .eq("id", pending.id)
          .select("*")
          .single();

        if (updatePaymentError) throw updatePaymentError;
        payment = updated;
      }
    }

    if (!payment) {
      const depositCents =
        booking.deposit_cents !== null && booking.deposit_cents !== undefined
          ? Number(booking.deposit_cents)
          : Math.round(Number(booking.deposit || 0) * 100);

      const amountCents =
        actualAmountCents > 0
          ? actualAmountCents
          : paymentType === "DEPOSIT"
          ? depositCents
          : 0;

      if (amountCents <= 0) {
        throw new Error("No fue posible determinar el monto del pago Shopify.");
      }

      const { data: inserted, error: insertPaymentError } = await supabaseAdmin
        .from("event_payments")
        .insert({
          booking_id: booking.id,
          provider: "SHOPIFY",
          provider_payment_id: shopifyOrderId,
          payment_method: paymentMethod(payload),
          amount_cents: amountCents,
          status: "PAID",
          payment_type: paymentType,
          reference: payload.name || null,
          recorded_by: "shopify",
          paid_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          raw_snapshot: {
            orderId: shopifyOrderId,
            orderName: payload.name || null,
            webhookId,
            financialStatus: payload.financial_status || null,
          },
        })
        .select("*")
        .single();

      if (insertPaymentError) {
        if (insertPaymentError.code === "23505") {
          return new Response("Already processed", { status: 200 });
        }
        throw insertPaymentError;
      }

      payment = inserted;
    }

    if (paymentType === "DEPOSIT") {
      const operationalStatuses = ["PREPARATION", "IN_SERVICE", "COMPLETED"];

      const nextStatus = operationalStatuses.includes(booking.status)
        ? booking.status
        : "CONFIRMED";

      const { error: bookingUpdateError } = await supabaseAdmin
        .from("bookings")
        .update({
          status: nextStatus,
          shopify_order_id: booking.shopify_order_id || shopifyOrderId,
          confirmed_at: booking.confirmed_at || new Date().toISOString(),
          hold_expires_at: null,
        })
        .eq("id", booking.id);

      if (bookingUpdateError) throw bookingUpdateError;

      const { error: holdError } = await supabaseAdmin
        .from("event_capacity_holds")
        .update({
          status: "CONVERTED",
          expires_at: null,
        })
        .eq("booking_id", booking.id);

      if (holdError) throw holdError;
    } else {
      const { error: balanceUpdateError } = await supabaseAdmin
        .from("bookings")
        .update({
          shopify_balance_order_id: shopifyOrderId,
        })
        .eq("id", booking.id);

      if (balanceUpdateError) throw balanceUpdateError;
    }

    await addTimeline({
      bookingId: booking.id,
      eventType:
        paymentType === "DEPOSIT"
          ? "PAYMENT_CONFIRMED"
          : "BALANCE_PAYMENT_CONFIRMED",
      title:
        paymentType === "DEPOSIT"
          ? `Anticipo confirmado: $${(
              Number(payment.amount_cents || 0) / 100
            ).toFixed(2)} MXN`
          : `Pago de saldo confirmado: $${(
              Number(payment.amount_cents || 0) / 100
            ).toFixed(2)} MXN`,
      description: payload.name || null,
      metadata: {
        payment_id: payment.id,
        payment_type: paymentType,
        shopify_order_id: shopifyOrderId,
        webhook_id: webhookId,
      },
    });

    console.log("JAVA EVENT PAYMENT CONFIRMED", {
      bookingId,
      paymentId: payment.id,
      paymentType,
      amountCents: payment.amount_cents,
      shopifyOrderId,
      webhookId,
    });

    return new Response("OK", { status: 200 });
  } catch (error) {
    console.error("Orders paid webhook error:", error);
    return new Response("Internal Server Error", { status: 500 });
  }
}
