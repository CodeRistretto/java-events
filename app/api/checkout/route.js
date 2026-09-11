import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { shopifyGraphQL } from "@/lib/shopify";
import { ensureShopifyCustomer } from "@/lib/shopifyCustomer";
import { normalizeMexicoPhone } from "@/lib/phone";

export const runtime =
  "nodejs";

function money(value) {
  return Number(
    value
  ).toFixed(2);
}

export async function POST(
  request
) {
  try {
    const body =
      await request.json();

    const {
      bookingId,
    } = body;

    // ============================================
    // BOOKING ID
    // ============================================

    if (!bookingId) {
      return Response.json(
        {
          success: false,
          error:
            "No se recibió el identificador de la reservación.",
        },
        { status: 400 }
      );
    }

    // ============================================
    // CARGAR BOOKING
    // ============================================

    const {
      data: booking,
      error: bookingError,
    } = await supabaseAdmin
      .from("bookings")
      .select(`
        id,
        customer_name,
        email,
        phone,
        event_type,
        city,
        state,
        event_address,
        event_date,
        start_time,
        duration_hours,
        guests,
        package_name,
        matcha_bar,
        extra_barista,
        total,
        deposit,
        balance,
        status,
        hold_expires_at,
        shopify_customer_id,
        shopify_draft_order_id,
        shopify_order_id
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
      return Response.json(
        {
          success: false,
          error:
            "No encontramos esta reservación.",
        },
        { status: 404 }
      );
    }

    // ============================================
    // YA CONFIRMADO
    // ============================================

    if (
      booking
        .shopify_order_id ||
      booking.status ===
        "CONFIRMED"
    ) {
      return Response.json({
        success: true,

        alreadyPaid:
          true,

        message:
          "Este evento ya se encuentra confirmado.",
      });
    }

    // ============================================
    // ESTATUS PERMITIDOS
    // ============================================

    if (
      ![
        "HOLD",
        "PAYMENT_PENDING",
      ].includes(
        booking.status
      )
    ) {
      return Response.json(
        {
          success: false,
          error:
            "Esta reservación ya no está disponible para pago.",
        },
        { status: 409 }
      );
    }

    // ============================================
    // HOLD VIGENTE
    // ============================================

    if (
      booking
        .hold_expires_at
    ) {
      const expiration =
        new Date(
          booking
            .hold_expires_at
        );

      if (
        expiration.getTime() <=
        Date.now()
      ) {
        await supabaseAdmin
          .from("bookings")
          .update({
            status:
              "EXPIRED",
          })
          .eq(
            "id",
            booking.id
          );

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

    // ============================================
    // NORMALIZAR TELÉFONO OTRA VEZ
    // ============================================

    const normalizedPhone =
      normalizeMexicoPhone(
        booking.phone
      );

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

    // ============================================
    // ANTICIPO
    // ============================================

    const deposit =
      Number(
        booking.deposit
      );

    if (
      !Number.isFinite(
        deposit
      ) ||
      deposit <= 0
    ) {
      return Response.json(
        {
          success: false,

          error:
            "El anticipo no es válido.",
        },
        { status: 400 }
      );
    }

    // ============================================
    // CREAR / ACTUALIZAR CLIENTE SHOPIFY
    // ============================================

    const customer =
      await ensureShopifyCustomer(
        {
          email:
            booking.email,

          phone:
            normalizedPhone,

          customerName:
            booking
              .customer_name,
        }
      );

    // Guardamos relación.
    await supabaseAdmin
      .from("bookings")
      .update({
        phone:
          normalizedPhone,

        shopify_customer_id:
          customer.id,
      })
      .eq(
        "id",
        booking.id
      );

    // ============================================
    // DRAFT ORDER YA EXISTENTE
    // ============================================

    if (
      booking
        .shopify_draft_order_id
    ) {
      const existingData =
        await shopifyGraphQL(
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

              order {
                id
              }
            }
          }
          `,
          {
            id:
              booking
                .shopify_draft_order_id,
          }
        );

      const existingDraft =
        existingData
          ?.draftOrder;

      if (
        existingDraft
          ?.order?.id
      ) {
        await supabaseAdmin
          .from("bookings")
          .update({
            status:
              "CONFIRMED",

            shopify_order_id:
              existingDraft
                .order.id,
          })
          .eq(
            "id",
            booking.id
          );

        return Response.json({
          success:
            true,

          alreadyPaid:
            true,

          message:
            "Este evento ya fue pagado.",
        });
      }

      if (
        existingDraft
          ?.invoiceUrl
      ) {
        return Response.json({
          success:
            true,

          checkoutUrl:
            existingDraft
              .invoiceUrl,

          draftOrderId:
            existingDraft.id,

          reused:
            true,

          holdExpiresAt:
            booking
              .hold_expires_at,
        });
      }
    }

    // ============================================
    // CREAR DRAFT ORDER
    // ============================================

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

            purchasingEntity {
              ... on Customer {
                id
                email
                phone
              }
            }

            totalPriceSet {
              presentmentMoney {
                amount
                currencyCode
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

    const variables = {
      input: {
        // Cliente real de Shopify.
        purchasingEntity: {
          customerId:
            customer.id,
        },

        email:
          booking.email,

        phone:
          normalizedPhone,

        presentmentCurrencyCode:
          "MXN",

        tags: [
          "JAVA_EVENT",
          "JAVA_COFFEE_CART",
          "EVENT_DEPOSIT",
        ],

        note:
          `Java Coffee Cart Event\n` +
          `Booking ID: ${booking.id}\n` +
          `Cliente: ${booking.customer_name}\n` +
          `WhatsApp: ${normalizedPhone}\n` +
          `Tipo: ${booking.event_type || "No especificado"}\n` +
          `Ciudad: ${booking.city}, ${booking.state}\n` +
          `Dirección: ${booking.event_address || "No especificada"}\n` +
          `Fecha: ${booking.event_date}\n` +
          `Hora: ${booking.start_time}\n` +
          `Duración: ${booking.duration_hours} horas\n` +
          `Invitados: ${booking.guests}\n` +
          `Matcha Bar: ${booking.matcha_bar ? "Sí" : "No"}\n` +
          `Barista adicional: ${booking.extra_barista ? "Sí" : "No"}\n` +
          `Total evento: $${money(booking.total)} MXN\n` +
          `Anticipo: $${money(booking.deposit)} MXN\n` +
          `Saldo: $${money(booking.balance)} MXN`,

        customAttributes: [
          {
            key:
              "java_booking_id",

            value:
              String(
                booking.id
              ),
          },

          {
            key:
              "event_type",

            value:
              String(
                booking
                  .event_type ||
                  ""
              ),
          },

          {
            key:
              "event_city",

            value:
              booking.city,
          },

          {
            key:
              "event_address",

            value:
              String(
                booking
                  .event_address ||
                  ""
              ),
          },

          {
            key:
              "event_date",

            value:
              String(
                booking
                  .event_date
              ),
          },

          {
            key:
              "event_time",

            value:
              String(
                booking
                  .start_time
              ),
          },

          {
            key:
              "event_guests",

            value:
              String(
                booking.guests
              ),
          },

          {
            key:
              "event_total",

            value:
              money(
                booking.total
              ),
          },

          {
            key:
              "event_balance",

            value:
              money(
                booking.balance
              ),
          },
        ],

        lineItems: [
          {
            title:
              "Anticipo Java Coffee Cart",

            quantity: 1,

            originalUnitPriceWithCurrency: {
              amount:
                money(
                  deposit
                ),

              currencyCode:
                "MXN",
            },

            requiresShipping:
              false,

            // Para pruebas.
            // Revisaremos impuestos antes
            // de producción.
            taxable:
              false,

            customAttributes: [
              {
                key:
                  "Booking ID",

                value:
                  String(
                    booking.id
                  ),
              },

              {
                key:
                  "Evento",

                value:
                  `${booking.event_date} ${booking.start_time}`,
              },

              {
                key:
                  "Ciudad",

                value:
                  booking.city,
              },
            ],
          },
        ],
      },
    };

    const result =
      await shopifyGraphQL(
        mutation,
        variables
      );

    const payload =
      result
        ?.draftOrderCreate;

    const userErrors =
      payload?.userErrors ||
      [];

    if (
      userErrors.length > 0
    ) {
      return Response.json(
        {
          success: false,

          error:
            userErrors
              .map(
                (error) =>
                  error.message
              )
              .join(" | "),
        },
        { status: 400 }
      );
    }

    const draftOrder =
      payload
        ?.draftOrder;

    if (
      !draftOrder?.id ||
      !draftOrder
        ?.invoiceUrl
    ) {
      throw new Error(
        "Shopify no devolvió un checkout válido."
      );
    }

    // ============================================
    // EXTENDER TIEMPO A 30 MIN.
    // ============================================

    const checkoutHoldExpiresAt =
      new Date(
        Date.now() +
          30 *
            60 *
            1000
      ).toISOString();

    const {
      error: updateError,
    } = await supabaseAdmin
      .from("bookings")
      .update({
        status:
          "PAYMENT_PENDING",

        phone:
          normalizedPhone,

        shopify_customer_id:
          customer.id,

        shopify_draft_order_id:
          draftOrder.id,

        hold_expires_at:
          checkoutHoldExpiresAt,
      })
      .eq(
        "id",
        booking.id
      );

    if (updateError) {
      throw updateError;
    }

    return Response.json({
      success: true,

      checkoutUrl:
        draftOrder
          .invoiceUrl,

      draftOrderId:
        draftOrder.id,

      draftOrderName:
        draftOrder.name,

      customerId:
        customer.id,

      customerPhone:
        normalizedPhone,

      reused:
        false,

      holdExpiresAt:
        checkoutHoldExpiresAt,
    });
  } catch (error) {
    console.error(
      "Checkout API error:",
      error
    );

    return Response.json(
      {
        success: false,

        error:
          error.message ||
          "No fue posible iniciar el pago.",
      },
      { status: 500 }
    );
  }
}