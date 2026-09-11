import crypto from "node:crypto";

import { requireAdmin } from "@/lib/adminAuth";
import { logAdminAction } from "@/lib/adminAudit";
import { getEventFinancialSummary } from "@/lib/eventPayments";
import { normalizeMexicoPhone } from "@/lib/phone";
import { shopifyGraphQL } from "@/lib/shopify";
import { ensureShopifyCustomer } from "@/lib/shopifyCustomer";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

function centsToMoney(cents) {
  return (Number(cents || 0) / 100).toFixed(2);
}

function withinTolerance(actual, expected, tolerance = 2) {
  return Math.abs(Number(actual) - Number(expected)) <= tolerance;
}

function shippingAddress(booking, phone) {
  if (!booking.event_address || !booking.city) return null;

  const parts = String(booking.customer_name || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  return {
    firstName: parts[0] || "Cliente",
    lastName: parts.slice(1).join(" ") || "Java Events",
    address1: booking.event_address,
    city: booking.city,
    zip: booking.postal_code || undefined,
    countryCode: "MX",
    phone,
  };
}

function buildInput({
  booking,
  customer,
  phone,
  linePriceCents,
  expectedVatCents,
  paymentId,
  remainingCents,
}) {
  const appBaseUrl = process.env.APP_BASE_URL || "http://localhost:3000";
  const confirmationUrl = `${appBaseUrl}/confirmation/${booking.id}`;

  const totalContractCents =
    booking.total_cents !== null && booking.total_cents !== undefined
      ? Number(booking.total_cents)
      : Math.round(Number(booking.total || 0) * 100);

  const input = {
    purchasingEntity: {
      customerId: customer.id,
    },
    email: booking.email,
    phone,
    presentmentCurrencyCode: "MXN",
    taxExempt: false,
    visibleToCustomer: true,
    tags: ["JAVA_EVENT", "JAVA_COFFEE_CART", "EVENT_BALANCE"],
    note:
      `JAVA COFFEE CART · SALDO DE EVENTO\n\n` +
      `Número de evento: ${booking.event_order_number || booking.id}\n` +
      `Cliente: ${booking.customer_name}\n` +
      `Fecha: ${booking.event_date}\n` +
      `Ciudad: ${booking.city}, ${booking.state}\n` +
      `Total contratado: $${centsToMoney(totalContractCents)} MXN\n` +
      `Saldo a pagar: $${centsToMoney(remainingCents)} MXN\n\n` +
      `Comprobante del evento:\n${confirmationUrl}`,
    customAttributes: [
      { key: "java_booking_id", value: String(booking.id) },
      { key: "java_payment_id", value: String(paymentId) },
      { key: "payment_type", value: "BALANCE" },
      {
        key: "event_order_number",
        value: String(booking.event_order_number || ""),
      },
      { key: "amount_to_pay", value: centsToMoney(remainingCents) },
      { key: "confirmation_url", value: confirmationUrl },
    ],
    lineItems: [
      {
        title: `Saldo Java Coffee Cart · ${
          booking.event_order_number || "Evento"
        }`,
        quantity: 1,
        originalUnitPriceWithCurrency: {
          amount: centsToMoney(linePriceCents),
          currencyCode: "MXN",
        },
        requiresShipping: false,
        taxable: true,
        customAttributes: [
          {
            key: "Qué estás pagando",
            value: "Saldo pendiente del evento Java Coffee Cart",
          },
          { key: "IVA esperado", value: centsToMoney(expectedVatCents) },
          { key: "Booking ID", value: String(booking.id) },
        ],
      },
    ],
  };

  const address = shippingAddress(booking, phone);
  if (address) input.shippingAddress = address;

  return input;
}

async function calculateDraft(input) {
  const data = await shopifyGraphQL(
    `
      mutation CalculateBalanceDraft($input: DraftOrderInput!) {
        draftOrderCalculate(input: $input) {
          calculatedDraftOrder {
            taxesIncluded
            subtotalPriceSet { presentmentMoney { amount currencyCode } }
            totalTaxSet { presentmentMoney { amount currencyCode } }
            totalPriceSet { presentmentMoney { amount currencyCode } }
          }
          userErrors { field message }
        }
      }
    `,
    { input }
  );

  const payload = data?.draftOrderCalculate;
  const errors = payload?.userErrors || [];

  if (errors.length) {
    throw new Error(errors.map((item) => item.message).join(" | "));
  }

  const calculated = payload?.calculatedDraftOrder;
  if (!calculated) throw new Error("Shopify no pudo calcular el saldo.");

  return {
    subtotalCents: Math.round(
      Number(calculated.subtotalPriceSet?.presentmentMoney?.amount || 0) * 100
    ),
    taxCents: Math.round(
      Number(calculated.totalTaxSet?.presentmentMoney?.amount || 0) * 100
    ),
    totalCents: Math.round(
      Number(calculated.totalPriceSet?.presentmentMoney?.amount || 0) * 100
    ),
  };
}

async function chooseTaxPlan({
  booking,
  customer,
  phone,
  paymentId,
  remainingCents,
}) {
  const vatBps = Number(booking.pricing_snapshot?.vatBps ?? 1600);
  const rate = vatBps / 10000;
  const expectedSubtotalCents = rate
    ? Math.round(remainingCents / (1 + rate))
    : remainingCents;
  const expectedVatCents = remainingCents - expectedSubtotalCents;

  const candidates = rate
    ? [remainingCents, expectedSubtotalCents]
    : [remainingCents];

  for (const linePriceCents of candidates) {
    const input = buildInput({
      booking,
      customer,
      phone,
      linePriceCents,
      expectedVatCents,
      paymentId,
      remainingCents,
    });

    const calculated = await calculateDraft(input);

    if (
      withinTolerance(calculated.totalCents, remainingCents) &&
      withinTolerance(calculated.taxCents, expectedVatCents)
    ) {
      return {
        input,
        calculated,
        expectedVatCents,
        expectedSubtotalCents,
      };
    }
  }

  throw new Error(
    `Shopify no está calculando correctamente el IVA del saldo. ` +
      `Saldo esperado: $${centsToMoney(
        remainingCents
      )} MXN. IVA esperado: $${centsToMoney(expectedVatCents)} MXN.`
  );
}

export async function POST(request) {
  try {
    const admin = requireAdmin(request);
    const body = await request.json();
    const bookingId = body.bookingId;

    if (!bookingId) {
      return Response.json(
        { success: false, error: "Falta bookingId." },
        { status: 400 }
      );
    }

    const { data: booking, error } = await supabaseAdmin
      .from("bookings")
      .select(`
        id,
        event_order_number,
        customer_name,
        email,
        phone,
        event_type,
        city,
        state,
        postal_code,
        event_address,
        event_date,
        start_time,
        guests,
        total,
        total_cents,
        deposit,
        deposit_cents,
        pricing_snapshot,
        status,
        shopify_customer_id,
        shopify_order_id,
        shopify_balance_draft_order_id,
        shopify_balance_order_id
      `)
      .eq("id", bookingId)
      .maybeSingle();

    if (error) throw error;

    if (!booking) {
      return Response.json(
        { success: false, error: "Evento no encontrado." },
        { status: 404 }
      );
    }

    if (["CANCELLED", "REFUNDED", "EXPIRED"].includes(booking.status)) {
      return Response.json(
        {
          success: false,
          error: "Este evento no admite nuevos cobros en su estado actual.",
        },
        { status: 409 }
      );
    }

    const { payments, summary } = await getEventFinancialSummary(booking);

    if (summary.remainingCents <= 0) {
      return Response.json({
        success: true,
        alreadyPaid: true,
        message: "El evento ya está liquidado.",
        summary,
      });
    }

    const existingPending = payments
      .filter(
        (item) =>
          item.provider === "SHOPIFY" &&
          item.status === "PENDING" &&
          ["BALANCE", "PARTIAL"].includes(item.payment_type) &&
          Number(item.amount_cents || 0) === summary.remainingCents &&
          item.raw_snapshot?.invoiceUrl
      )
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))[0];

    if (existingPending) {
      return Response.json({
        success: true,
        reused: true,
        checkoutUrl: existingPending.raw_snapshot.invoiceUrl,
        paymentId: existingPending.id,
        amount: Number(existingPending.amount_cents) / 100,
        summary,
      });
    }

    const phone = normalizeMexicoPhone(booking.phone);
    if (!phone) {
      return Response.json(
        { success: false, error: "El teléfono del cliente no es válido." },
        { status: 400 }
      );
    }

    const customer = await ensureShopifyCustomer({
      email: booking.email,
      phone,
      customerName: booking.customer_name,
    });

    const paymentId = crypto.randomUUID();

    const plan = await chooseTaxPlan({
      booking,
      customer,
      phone,
      paymentId,
      remainingCents: summary.remainingCents,
    });

    const created = await shopifyGraphQL(
      `
        mutation CreateBalanceDraft($input: DraftOrderInput!) {
          draftOrderCreate(input: $input) {
            draftOrder {
              id
              name
              invoiceUrl
              status
              subtotalPriceSet { presentmentMoney { amount currencyCode } }
              totalTaxSet { presentmentMoney { amount currencyCode } }
              totalPriceSet { presentmentMoney { amount currencyCode } }
            }
            userErrors { field message }
          }
        }
      `,
      { input: plan.input }
    );

    const payload = created?.draftOrderCreate;
    const userErrors = payload?.userErrors || [];

    if (userErrors.length) {
      throw new Error(userErrors.map((item) => item.message).join(" | "));
    }

    const draft = payload?.draftOrder;

    if (!draft?.id || !draft?.invoiceUrl) {
      throw new Error("Shopify no devolvió un checkout para el saldo.");
    }

    const finalTotalCents = Math.round(
      Number(draft.totalPriceSet?.presentmentMoney?.amount || 0) * 100
    );
    const finalTaxCents = Math.round(
      Number(draft.totalTaxSet?.presentmentMoney?.amount || 0) * 100
    );

    if (
      !withinTolerance(finalTotalCents, summary.remainingCents) ||
      !withinTolerance(finalTaxCents, plan.expectedVatCents)
    ) {
      throw new Error(
        "El total final de Shopify no coincide con el saldo de Java Events."
      );
    }

    const { error: paymentError } = await supabaseAdmin
      .from("event_payments")
      .insert({
        id: paymentId,
        booking_id: booking.id,
        provider: "SHOPIFY",
        provider_payment_id: draft.id,
        payment_method: "SHOPIFY_CHECKOUT",
        amount_cents: summary.remainingCents,
        status: "PENDING",
        payment_type: "BALANCE",
        reference: draft.name || null,
        recorded_by: admin.username,
        updated_at: new Date().toISOString(),
        raw_snapshot: {
          draftOrderId: draft.id,
          draftOrderName: draft.name,
          invoiceUrl: draft.invoiceUrl,
          expectedVatCents: plan.expectedVatCents,
          expectedSubtotalCents: plan.expectedSubtotalCents,
        },
      });

    if (paymentError) throw paymentError;

    const { error: bookingUpdateError } = await supabaseAdmin
      .from("bookings")
      .update({
        shopify_customer_id: customer.id,
        shopify_balance_draft_order_id: draft.id,
      })
      .eq("id", booking.id);

    if (bookingUpdateError) throw bookingUpdateError;

    const { error: timelineError } = await supabaseAdmin
      .from("event_timeline")
      .insert({
        booking_id: booking.id,
        event_type: "BALANCE_CHECKOUT_CREATED",
        title: `Checkout de saldo creado: $${summary.remaining.toFixed(2)} MXN`,
        description: draft.name || null,
        actor: admin.username,
        metadata: {
          payment_id: paymentId,
          draft_order_id: draft.id,
          amount_cents: summary.remainingCents,
        },
      });

    if (timelineError) throw timelineError;

    await logAdminAction({
      adminId: admin.username,
      action: "CREATE_BALANCE_CHECKOUT",
      entityType: "event_payments",
      entityId: paymentId,
      oldValue: null,
      newValue: {
        booking_id: booking.id,
        amount_cents: summary.remainingCents,
        draft_order_id: draft.id,
      },
    });

    return Response.json({
      success: true,
      checkoutUrl: draft.invoiceUrl,
      paymentId,
      amount: summary.remaining,
      summary,
    });
  } catch (error) {
    console.error("Balance checkout error:", error);

    const status =
      error?.status ||
      (error?.message === "UNAUTHORIZED" ? 401 : 500);

    return Response.json(
      {
        success: false,
        error:
          error?.message === "UNAUTHORIZED"
            ? "Unauthorized"
            : error?.message || "No fue posible crear el checkout de saldo.",
      },
      { status }
    );
  }
}
