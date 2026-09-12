import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { shopifyGraphQL } from "@/lib/shopify";
import { ensureShopifyCustomer } from "@/lib/shopifyCustomer";
import { normalizeMexicoPhone } from "@/lib/phone";
import {
  deliverMetaConversion,
  requestContext,
} from "@/lib/metaConversions";

export const runtime = "nodejs";

const JAVA_EVENTS_VARIANT_ID =
  process.env.SHOPIFY_EVENT_VARIANT_ID ||
  "gid://shopify/ProductVariant/46649709789380";

function money(value) {
  return Number(value || 0).toFixed(2);
}

function centsToMoney(cents) {
  return (Number(cents || 0) / 100).toFixed(2);
}

function asCents(centsValue, legacyMoneyValue) {
  if (centsValue !== null && centsValue !== undefined) {
    return Number(centsValue);
  }

  return Math.round(Number(legacyMoneyValue || 0) * 100);
}

function withinTolerance(actual, expected, tolerance = 2) {
  return Math.abs(Number(actual) - Number(expected)) <= tolerance;
}

function eventAddressInput(booking, normalizedPhone) {
  if (!booking.event_address || !booking.city) {
    return null;
  }

  const parts = String(booking.customer_name || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  const firstName = parts[0] || "Cliente";
  const lastName = parts.slice(1).join(" ") || "Java Events";

  return {
    firstName,
    lastName,
    address1: booking.event_address,
    city: booking.city,
    zip: booking.postal_code || undefined,
    countryCode: "MX",
    phone: normalizedPhone,
  };
}

function trackingDraftAttributes(booking) {
  const fields = [
    ["utm_source", booking.utm_source],
    ["utm_medium", booking.utm_medium],
    ["utm_campaign", booking.utm_campaign],
    ["utm_content", booking.utm_content],
    ["utm_term", booking.utm_term],
    ["fbclid", booking.fbclid],
    ["gclid", booking.gclid],
    ["gbraid", booking.gbraid],
    ["wbraid", booking.wbraid],
    ["ttclid", booking.ttclid],
    ["client_session_id", booking.client_session_id],
    ["landing_page", booking.landing_page],
    ["referrer", booking.referrer],
  ];

  return fields
    .filter(([, value]) => String(value || "").trim())
    .map(([key, value]) => ({ key, value: String(value).slice(0, 255) }));
}

function bookingAttribution(booking) {
  return {
    utm_source: booking.utm_source,
    utm_medium: booking.utm_medium,
    utm_campaign: booking.utm_campaign,
    utm_content: booking.utm_content,
    utm_term: booking.utm_term,
    fbclid: booking.fbclid,
    fbc: booking.fbc,
    fbp: booking.fbp,
    gclid: booking.gclid,
    gbraid: booking.gbraid,
    wbraid: booking.wbraid,
    ttclid: booking.ttclid,
    landing_page: booking.landing_page,
    referrer: booking.referrer,
    client_session_id: booking.client_session_id,
    test_event_code: booking.meta_test_event_code,
  };
}

async function trackInitiateCheckout({ booking, depositCents, request, fallbackUrl }) {
  const variantId = String(JAVA_EVENTS_VARIANT_ID).split("/").pop();

  await deliverMetaConversion({
    bookingId: booking.id,
    eventName: "InitiateCheckout",
    eventId: `java-checkout-${booking.id}`,
    eventSourceUrl: booking.landing_page || fallbackUrl,
    attribution: bookingAttribution(booking),
    context: requestContext(request),
    customer: {
      name: booking.customer_name,
      email: booking.email,
      phone: booking.phone,
      city: booking.city,
      state: booking.state,
      postalCode: booking.postal_code,
      externalId: booking.client_session_id || booking.id,
      clientIpAddress: booking.client_ip_address,
      clientUserAgent: booking.client_user_agent,
    },
    customData: {
      content_name: "Java Coffee Cart — Events",
      content_category: "Event deposit",
      content_type: "product",
      content_ids: [variantId],
      num_items: 1,
      value: Number(centsToMoney(depositCents)),
      currency: "MXN",
      event_total: Number(booking.total || 0),
      booking_id: booking.id,
      event_order_number: booking.event_order_number || "",
    },
  });
}

function buildLineItem({
  booking,
  priceCents,
  expectedVatCents,
}) {
  return {
    variantId: JAVA_EVENTS_VARIANT_ID,
    quantity: 1,

    priceOverride: {
      amount: centsToMoney(priceCents),
      currencyCode: "MXN",
    },

    customAttributes: [
      {
        key: "Qué estás pagando",
        value: "Anticipo para apartar la fecha del evento",
      },
      {
        key: "IVA esperado",
        value: centsToMoney(expectedVatCents),
      },
      {
        key: "Booking ID",
        value: String(booking.id),
      },
      {
        key: "Evento",
        value: `${booking.event_date} ${booking.start_time}`,
      },
      {
        key: "Ciudad",
        value: booking.city,
      },
      {
        key: "Invitados",
        value: String(booking.guests),
      },
    ],
  };
}

function baseDraftInput({
  booking,
  customer,
  normalizedPhone,
  lineItem,
  confirmationUrl,
}) {
  const address = eventAddressInput(booking, normalizedPhone);

  const input = {
    purchasingEntity: {
      customerId: customer.id,
    },

    email: booking.email,
    phone: normalizedPhone,
    presentmentCurrencyCode: "MXN",
    taxExempt: false,
    visibleToCustomer: true,

    tags: [
      "JAVA_EVENT",
      "JAVA_COFFEE_CART",
      "EVENT_DEPOSIT",
    ],

    note:
      `JAVA COFFEE CART · EVENTO\n\n` +
      `Número de evento: ${
        booking.event_order_number || booking.id
      }\n` +
      `Cliente: ${booking.customer_name}\n` +
      `WhatsApp: ${normalizedPhone}\n` +
      `Tipo de evento: ${
        booking.event_type || "No especificado"
      }\n` +
      `Lugar: ${
        booking.venue_name || "No especificado"
      }\n` +
      `Ciudad: ${booking.city}, ${booking.state}\n` +
      `Dirección: ${
        booking.event_address || "No especificada"
      }\n` +
      `Fecha: ${booking.event_date}\n` +
      `Hora: ${booking.start_time}\n` +
      `Duración: ${booking.duration_hours} horas\n` +
      `Invitados: ${booking.guests}\n\n` +
      `QUÉ ESTÁ PAGANDO EL CLIENTE:\n` +
      `Anticipo para apartar la fecha del evento.\n\n` +
      `Total completo del evento: $${money(
        booking.total
      )} MXN\n` +
      `Anticipo a pagar hoy: $${money(
        booking.deposit
      )} MXN\n` +
      `Saldo pendiente: $${money(
        booking.balance
      )} MXN\n\n` +
      `Estado del evento:\n${confirmationUrl}`,

    customAttributes: [
      {
        key: "java_booking_id",
        value: String(booking.id),
      },
      {
        key: "event_order_number",
        value: String(booking.event_order_number || ""),
      },
      {
        key: "purchase_type",
        value: "Anticipo para apartar fecha de evento",
      },
      {
        key: "event_type",
        value: String(booking.event_type || ""),
      },
      {
        key: "event_city",
        value: booking.city,
      },
      {
        key: "event_date",
        value: String(booking.event_date),
      },
      {
        key: "event_time",
        value: String(booking.start_time),
      },
      {
        key: "event_guests",
        value: String(booking.guests),
      },
      {
        key: "event_total",
        value: money(booking.total),
      },
      {
        key: "amount_paid_today",
        value: money(booking.deposit),
      },
      {
        key: "event_balance",
        value: money(booking.balance),
      },
      {
        key: "confirmation_url",
        value: confirmationUrl,
      },
      ...trackingDraftAttributes(booking),
    ],

    lineItems: [lineItem],
  };

  if (address) {
    input.shippingAddress = address;
  }

  return input;
}

async function calculateDraft(input) {
  const mutation = `
    mutation CalculateJavaEventDraft(
      $input: DraftOrderInput!
    ) {
      draftOrderCalculate(
        input: $input
      ) {
        calculatedDraftOrder {
          taxesIncluded

          subtotalPriceSet {
            presentmentMoney {
              amount
              currencyCode
            }
          }

          totalTaxSet {
            presentmentMoney {
              amount
              currencyCode
            }
          }

          totalPriceSet {
            presentmentMoney {
              amount
              currencyCode
            }
          }

          taxLines {
            title
            rate
            ratePercentage

            priceSet {
              presentmentMoney {
                amount
                currencyCode
              }
            }
          }
        }

        userErrors {
          field
          message
        }
      }
    }
  `;

  const result = await shopifyGraphQL(mutation, { input });

  const payload = result?.draftOrderCalculate;
  const userErrors = payload?.userErrors || [];

  if (userErrors.length > 0) {
    throw new Error(
      userErrors.map((error) => error.message).join(" | ")
    );
  }

  const calculated = payload?.calculatedDraftOrder;

  if (!calculated) {
    throw new Error("Shopify no pudo calcular el anticipo.");
  }

  return {
    raw: calculated,

    subtotalCents: Math.round(
      Number(
        calculated.subtotalPriceSet?.presentmentMoney?.amount || 0
      ) * 100
    ),

    taxCents: Math.round(
      Number(
        calculated.totalTaxSet?.presentmentMoney?.amount || 0
      ) * 100
    ),

    totalCents: Math.round(
      Number(
        calculated.totalPriceSet?.presentmentMoney?.amount || 0
      ) * 100
    ),

    taxesIncluded: Boolean(calculated.taxesIncluded),
  };
}

async function chooseShopifyTaxPlan({
  booking,
  customer,
  normalizedPhone,
  confirmationUrl,
  depositCents,
  vatBps,
}) {
  const rate = Number(vatBps || 0) / 10000;

  if (!rate || rate <= 0) {
    const lineItem = buildLineItem({
      booking,
      priceCents: depositCents,
      expectedVatCents: 0,
    });

    return {
      input: baseDraftInput({
        booking,
        customer,
        normalizedPhone,
        lineItem,
        confirmationUrl,
      }),
      expectedVatCents: 0,
      expectedSubtotalCents: depositCents,
    };
  }

  const expectedSubtotalCents = Math.round(
    depositCents / (1 + rate)
  );

  const expectedVatCents = depositCents - expectedSubtotalCents;

  const candidates = [
    {
      name: "TAX_INCLUDED_PRICE",
      linePriceCents: depositCents,
    },
    {
      name: "TAX_EXCLUDED_PRICE",
      linePriceCents: expectedSubtotalCents,
    },
  ];

  const attempts = [];

  for (const candidate of candidates) {
    const lineItem = buildLineItem({
      booking,
      priceCents: candidate.linePriceCents,
      expectedVatCents,
    });

    const input = baseDraftInput({
      booking,
      customer,
      normalizedPhone,
      lineItem,
      confirmationUrl,
    });

    const calculated = await calculateDraft(input);

    attempts.push({
      ...candidate,
      calculated,
    });

    const totalMatches = withinTolerance(
      calculated.totalCents,
      depositCents
    );

    const vatMatches = withinTolerance(
      calculated.taxCents,
      expectedVatCents
    );

    if (totalMatches && vatMatches) {
      return {
        input,
        expectedVatCents,
        expectedSubtotalCents,
        calculated,
        mode: candidate.name,
      };
    }
  }

  console.error("Shopify tax calculation mismatch", {
    depositCents,
    expectedSubtotalCents,
    expectedVatCents,
    vatBps,
    attempts,
  });

  throw new Error(
    `Shopify no está calculando el IVA configurado correctamente. ` +
      `El anticipo esperado es ${centsToMoney(
        depositCents
      )} MXN, con IVA de ${centsToMoney(
        expectedVatCents
      )} MXN. ` +
      `Revisa Shopify > Settings > Taxes and duties antes de aceptar el pago.`
  );
}

export async function POST(request) {
  try {
    const body = await request.json();
    const { bookingId } = body;

    if (!bookingId) {
      return Response.json(
        {
          success: false,
          error: "No se recibió el identificador de la reservación.",
        },
        { status: 400 }
      );
    }

    const { data: booking, error: bookingError } = await supabaseAdmin
      .from("bookings")
      .select(`
        id,
        customer_name,
        email,
        phone,
        event_type,
        city,
        state,
        postal_code,
        event_address,
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
        pricing_snapshot,
        event_order_number,
        status,
        hold_expires_at,
        shopify_customer_id,
        shopify_draft_order_id,
        shopify_order_id,
        utm_source,
        utm_medium,
        utm_campaign,
        utm_content,
        utm_term,
        fbclid,
        fbc,
        fbp,
        gclid,
        gbraid,
        wbraid,
        ttclid,
        landing_page,
        referrer,
        client_session_id,
        client_ip_address,
        client_user_agent,
        meta_test_event_code
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
          error: "No encontramos esta reservación.",
        },
        { status: 404 }
      );
    }

    const appBaseUrl = (
      process.env.APP_BASE_URL || "http://localhost:3000"
    ).replace(/\/+$/, "");

    const confirmationUrl =
      `${appBaseUrl}/confirmation/${booking.id}`;

    if (
      booking.shopify_order_id ||
      booking.status === "CONFIRMED"
    ) {
      return Response.json({
        success: true,
        alreadyPaid: true,
        message: "Este evento ya se encuentra confirmado.",
        confirmationUrl,
      });
    }

    if (!["HOLD", "PAYMENT_PENDING"].includes(booking.status)) {
      return Response.json(
        {
          success: false,
          error: "Esta reservación ya no está disponible para pago.",
        },
        { status: 409 }
      );
    }

    if (booking.hold_expires_at) {
      const expiration = new Date(booking.hold_expires_at);

      if (expiration.getTime() <= Date.now()) {
        await supabaseAdmin
          .from("bookings")
          .update({
            status: "EXPIRED",
          })
          .eq("id", booking.id);

        await supabaseAdmin
          .from("event_capacity_holds")
          .delete()
          .eq("booking_id", booking.id);

        return Response.json(
          {
            success: false,
            error:
              "El tiempo de apartado terminó. Vuelve a consultar disponibilidad.",
          },
          { status: 409 }
        );
      }
    }

    const normalizedPhone = normalizeMexicoPhone(booking.phone);

    if (!normalizedPhone) {
      return Response.json(
        {
          success: false,
          error:
            "El teléfono almacenado no es válido. Debe contener 10 dígitos mexicanos.",
        },
        { status: 400 }
      );
    }

    const depositCents = asCents(
      booking.deposit_cents,
      booking.deposit
    );

    if (!Number.isFinite(depositCents) || depositCents <= 0) {
      return Response.json(
        {
          success: false,
          error: "El anticipo no es válido.",
        },
        { status: 400 }
      );
    }

    const vatBps = Number(
      booking.pricing_snapshot?.vatBps ?? 1600
    );

    const customer = await ensureShopifyCustomer({
      email: booking.email,
      phone: normalizedPhone,
      customerName: booking.customer_name,
    });

    await supabaseAdmin
      .from("bookings")
      .update({
        phone: normalizedPhone,
        shopify_customer_id: customer.id,
      })
      .eq("id", booking.id);

    if (booking.shopify_draft_order_id) {
      const existingData = await shopifyGraphQL(
        `
        query ExistingJavaDraft(
          $id: ID!
        ) {
          draftOrder(
            id: $id
          ) {
            id
            name
            invoiceUrl
            status

            subtotalPriceSet {
              presentmentMoney {
                amount
                currencyCode
              }
            }

            totalTaxSet {
              presentmentMoney {
                amount
                currencyCode
              }
            }

            totalPriceSet {
              presentmentMoney {
                amount
                currencyCode
              }
            }

            order {
              id
            }
          }
        }
        `,
        {
          id: booking.shopify_draft_order_id,
        }
      );

      const existingDraft = existingData?.draftOrder;

      if (existingDraft?.order?.id) {
        await supabaseAdmin
          .from("bookings")
          .update({
            status: "CONFIRMED",
            shopify_order_id: existingDraft.order.id,
            confirmed_at: new Date().toISOString(),
          })
          .eq("id", booking.id);

        return Response.json({
          success: true,
          alreadyPaid: true,
          message: "Este evento ya fue pagado.",
          confirmationUrl,
        });
      }

      if (existingDraft?.invoiceUrl) {
        try {
          await trackInitiateCheckout({
            booking,
            depositCents,
            request,
            fallbackUrl: appBaseUrl,
          });
        } catch (trackingError) {
          console.error("InitiateCheckout Meta tracking error", {
            bookingId: booking.id,
            error: trackingError.message,
          });
        }

        return Response.json({
          success: true,
          checkoutUrl: existingDraft.invoiceUrl,
          draftOrderId: existingDraft.id,
          reused: true,
          holdExpiresAt: booking.hold_expires_at,
          confirmationUrl,
          shopifyTax: Number(
            existingDraft.totalTaxSet?.presentmentMoney?.amount || 0
          ),
        });
      }
    }

    const taxPlan = await chooseShopifyTaxPlan({
      booking,
      customer,
      normalizedPhone,
      confirmationUrl,
      depositCents,
      vatBps,
    });

    const mutation = `
      mutation CreateJavaEventDraft(
        $input: DraftOrderInput!
      ) {
        draftOrderCreate(
          input: $input
        ) {
          draftOrder {
            id
            name
            invoiceUrl
            status
            phone
            email
            taxesIncluded

            purchasingEntity {
              ... on Customer {
                id
                email
                phone
              }
            }

            subtotalPriceSet {
              presentmentMoney {
                amount
                currencyCode
              }
            }

            totalTaxSet {
              presentmentMoney {
                amount
                currencyCode
              }
            }

            totalPriceSet {
              presentmentMoney {
                amount
                currencyCode
              }
            }

            taxLines {
              title
              rate
              ratePercentage

              priceSet {
                presentmentMoney {
                  amount
                  currencyCode
                }
              }
            }
          }

          userErrors {
            field
            message
          }
        }
      }
    `;

    const result = await shopifyGraphQL(mutation, {
      input: taxPlan.input,
    });

    const payload = result?.draftOrderCreate;
    const userErrors = payload?.userErrors || [];

    if (userErrors.length > 0) {
      return Response.json(
        {
          success: false,
          error: userErrors.map((error) => error.message).join(" | "),
        },
        { status: 400 }
      );
    }

    const draftOrder = payload?.draftOrder;

    if (!draftOrder?.id || !draftOrder?.invoiceUrl) {
      throw new Error(
        "Shopify no devolvió un checkout válido."
      );
    }

    const finalTaxCents = Math.round(
      Number(
        draftOrder.totalTaxSet?.presentmentMoney?.amount || 0
      ) * 100
    );

    const finalTotalCents = Math.round(
      Number(
        draftOrder.totalPriceSet?.presentmentMoney?.amount || 0
      ) * 100
    );

    if (
      !withinTolerance(
        finalTaxCents,
        taxPlan.expectedVatCents
      ) ||
      !withinTolerance(
        finalTotalCents,
        depositCents
      )
    ) {
      throw new Error(
        "Shopify creó un borrador con impuestos distintos a la cotización de Java. No continúes con ese pago; revisa la configuración fiscal de Shopify."
      );
    }

    const { data: settings } = await supabaseAdmin
      .from("event_settings")
      .select("checkout_hold_minutes")
      .eq("id", 1)
      .maybeSingle();

    const checkoutMinutes = Number(
      settings?.checkout_hold_minutes || 30
    );

    const checkoutHoldExpiresAt = new Date(
      Date.now() + checkoutMinutes * 60 * 1000
    ).toISOString();

    const { error: updateError } = await supabaseAdmin
      .from("bookings")
      .update({
        status: "PAYMENT_PENDING",
        phone: normalizedPhone,
        shopify_customer_id: customer.id,
        shopify_draft_order_id: draftOrder.id,
        hold_expires_at: checkoutHoldExpiresAt,
      })
      .eq("id", booking.id);

    if (updateError) {
      throw updateError;
    }

    try {
      await trackInitiateCheckout({
        booking,
        depositCents,
        request,
        fallbackUrl: appBaseUrl,
      });
    } catch (trackingError) {
      console.error("InitiateCheckout Meta tracking error", {
        bookingId: booking.id,
        error: trackingError.message,
      });
    }

    return Response.json({
      success: true,
      checkoutUrl: draftOrder.invoiceUrl,
      confirmationUrl,
      draftOrderId: draftOrder.id,
      draftOrderName: draftOrder.name,
      customerId: customer.id,
      reused: false,
      holdExpiresAt: checkoutHoldExpiresAt,

      paymentBreakdown: {
        currency: "MXN",
        subtotal: Number(
          draftOrder.subtotalPriceSet?.presentmentMoney?.amount || 0
        ),
        tax: Number(
          draftOrder.totalTaxSet?.presentmentMoney?.amount || 0
        ),
        total: Number(
          draftOrder.totalPriceSet?.presentmentMoney?.amount || 0
        ),
        taxesIncluded: Boolean(draftOrder.taxesIncluded),
      },
    });
  } catch (error) {
    console.error("Checkout API error:", error);

    return Response.json(
      {
        success: false,
        error:
          error.message || "No fue posible iniciar el pago.",
      },
      { status: 500 }
    );
  }
}
