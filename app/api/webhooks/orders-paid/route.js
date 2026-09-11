import crypto from "crypto";

import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

// ============================================
// VERIFICAR FIRMA SHOPIFY
// ============================================

function verifyShopifyWebhook(
  rawBody,
  receivedHmac
) {
  const secret =
    process.env.SHOPIFY_CLIENT_SECRET;

  if (
    !secret ||
    !receivedHmac
  ) {
    return false;
  }

  const calculatedHmac =
    crypto
      .createHmac(
        "sha256",
        secret
      )
      .update(
        rawBody,
        "utf8"
      )
      .digest(
        "base64"
      );

  const receivedBuffer =
    Buffer.from(
      receivedHmac,
      "utf8"
    );

  const calculatedBuffer =
    Buffer.from(
      calculatedHmac,
      "utf8"
    );

  if (
    receivedBuffer.length !==
    calculatedBuffer.length
  ) {
    return false;
  }

  return crypto.timingSafeEqual(
    receivedBuffer,
    calculatedBuffer
  );
}

// ============================================
// ENCONTRAR BOOKING ID
// ============================================

function getJavaBookingId(
  payload
) {
  const attributes =
    payload.note_attributes ||
    [];

  for (
    const attribute of attributes
  ) {
    const name =
      attribute.name ||
      attribute.key;

    if (
      name ===
      "java_booking_id"
    ) {
      return String(
        attribute.value ||
        ""
      ).trim();
    }
  }

  return null;
}

// ============================================
// WEBHOOK ORDERS / PAID
// ============================================

export async function POST(
  request
) {
  try {
    // MUY IMPORTANTE:
    // debemos leer el body CRUDO antes
    // de parsearlo para validar HMAC.
    const rawBody =
      await request.text();

    const receivedHmac =
      request.headers.get(
        "x-shopify-hmac-sha256"
      );

    const webhookId =
      request.headers.get(
        "x-shopify-webhook-id"
      );

    const topic =
      request.headers.get(
        "x-shopify-topic"
      );

    const shop =
      request.headers.get(
        "x-shopify-shop-domain"
      );

    // ============================================
    // VALIDAR FIRMA
    // ============================================

    const valid =
      verifyShopifyWebhook(
        rawBody,
        receivedHmac
      );

    if (!valid) {
      console.error(
        "Invalid Shopify webhook HMAC",
        {
          webhookId,
          topic,
          shop,
        }
      );

      return new Response(
        "Unauthorized",
        {
          status: 401,
        }
      );
    }

    // ============================================
    // PARSEAR
    // ============================================

    let payload;

    try {
      payload =
        JSON.parse(
          rawBody
        );
    } catch {
      return new Response(
        "Invalid JSON",
        {
          status: 400,
        }
      );
    }

    // ============================================
    // EXTRAER BOOKING
    // ============================================

    const bookingId =
      getJavaBookingId(
        payload
      );

    if (!bookingId) {
      console.warn(
        "Paid Shopify order without Java booking ID",
        {
          webhookId,
          orderId:
            payload.id,
          orderName:
            payload.name,
        }
      );

      // Respondemos 200 porque el webhook
      // sí fue procesado, simplemente no
      // corresponde a Java Events.
      return new Response(
        "Ignored",
        {
          status: 200,
        }
      );
    }

    // ============================================
    // SHOPIFY ORDER ID
    // ============================================

    const shopifyOrderId =
      payload
        .admin_graphql_api_id ||
      (
        payload.id
          ? `gid://shopify/Order/${payload.id}`
          : null
      );

    // ============================================
    // BUSCAR BOOKING
    // ============================================

    const {
      data: booking,
      error: bookingError,
    } = await supabaseAdmin
      .from("bookings")
      .select(`
        id,
        status,
        shopify_order_id,
        shopify_draft_order_id
      `)
      .eq(
        "id",
        bookingId
      )
      .maybeSingle();

    if (bookingError) {
      throw bookingError;
    }

    if (!booking) {
      console.error(
        "Java booking not found for paid order",
        {
          bookingId,
          shopifyOrderId,
          webhookId,
        }
      );

      // Si devolvemos 500 Shopify
      // volverá a intentar.
      return new Response(
        "Booking not found",
        {
          status: 500,
        }
      );
    }

    // ============================================
    // IDEMPOTENCIA
    //
    // Si Shopify manda el webhook más de una vez,
    // no pasa nada.
    // ============================================

    if (
      booking.status ===
        "CONFIRMED" &&
      booking.shopify_order_id
    ) {
      return new Response(
        "Already confirmed",
        {
          status: 200,
        }
      );
    }

    // ============================================
    // CONFIRMAR EVENTO
    // ============================================

    const {
      error: updateError,
    } = await supabaseAdmin
      .from("bookings")
      .update({
        status:
          "CONFIRMED",

        shopify_order_id:
          shopifyOrderId,

        // Ya no necesitamos expiración
        // porque el pago ya confirmó
        // definitivamente el evento.
        hold_expires_at:
          null,
      })
      .eq(
        "id",
        bookingId
      );

    if (updateError) {
      throw updateError;
    }

    console.log(
      "JAVA EVENT CONFIRMED",
      {
        bookingId,
        shopifyOrderId,
        orderName:
          payload.name,
        webhookId,
      }
    );

    return new Response(
      "OK",
      {
        status: 200,
      }
    );
  } catch (error) {
    console.error(
      "Orders paid webhook error:",
      error
    );

    return new Response(
      "Internal Server Error",
      {
        status: 500,
      }
    );
  }
}