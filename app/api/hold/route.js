import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { calculateEventPrice } from "@/lib/pricing";

function timeToMinutes(time) {
  const [hours, minutes] = time
    .slice(0, 5)
    .split(":")
    .map(Number);

  return hours * 60 + minutes;
}

function rangesOverlap(
  startA,
  endA,
  startB,
  endB
) {
  return startA < endB && startB < endA;
}

export async function POST(request) {
  try {
    const body = await request.json();

    const {
      serviceAreaId,

      eventDate,
      startTime,

      guests,
      hours,

      matchaBar = false,
      extraBarista = false,

      customerName,
      email,
      phone,

      eventAddress = "",
      eventType = "",
    } = body;

    // ============================================
    // VALIDACIONES
    // ============================================

    if (!serviceAreaId) {
      return Response.json(
        {
          success: false,
          error: "Debes seleccionar una ciudad.",
        },
        {
          status: 400,
        }
      );
    }

    if (!eventDate) {
      return Response.json(
        {
          success: false,
          error:
            "Debes seleccionar la fecha del evento.",
        },
        {
          status: 400,
        }
      );
    }

    if (!startTime) {
      return Response.json(
        {
          success: false,
          error:
            "Debes seleccionar la hora del evento.",
        },
        {
          status: 400,
        }
      );
    }

    const numberGuests = Number(guests);
    const numberHours = Number(hours);

    if (!numberGuests || numberGuests < 1) {
      return Response.json(
        {
          success: false,
          error:
            "El número de invitados no es válido.",
        },
        {
          status: 400,
        }
      );
    }

    if (!numberHours || numberHours < 1) {
      return Response.json(
        {
          success: false,
          error:
            "La duración del evento no es válida.",
        },
        {
          status: 400,
        }
      );
    }

    if (!customerName?.trim()) {
      return Response.json(
        {
          success: false,
          error: "Escribe tu nombre.",
        },
        {
          status: 400,
        }
      );
    }

    if (!email?.trim()) {
      return Response.json(
        {
          success: false,
          error:
            "Escribe tu correo electrónico.",
        },
        {
          status: 400,
        }
      );
    }

    if (!phone?.trim()) {
      return Response.json(
        {
          success: false,
          error:
            "Escribe tu número de WhatsApp.",
        },
        {
          status: 400,
        }
      );
    }

    // ============================================
    // VALIDAR ZONA DE SERVICIO
    // ============================================

    const {
      data: serviceArea,
      error: serviceAreaError,
    } = await supabaseAdmin
      .from("service_areas")
      .select(
        `
        id,
        city,
        state,
        active
        `
      )
      .eq("id", serviceAreaId)
      .eq("active", true)
      .maybeSingle();

    if (serviceAreaError) {
      throw serviceAreaError;
    }

    if (!serviceArea) {
      return Response.json(
        {
          success: false,

          error:
            "Java Coffee Cart todavía no está disponible en esta zona.",
        },
        {
          status: 400,
        }
      );
    }

    // ============================================
    // CALCULAR PRECIO NUEVAMENTE EN SERVIDOR
    // ============================================

    const quote = calculateEventPrice({
      guests: numberGuests,
      hours: numberHours,
      matchaBar,
      extraBarista,
    });

    // ============================================
    // BUSCAR COFFEE CARTS ACTIVOS
    // ============================================

    const {
      data: carts,
      error: cartsError,
    } = await supabaseAdmin
      .from("coffee_carts")
      .select(
        `
        id,
        name,
        code,
        city,
        active
        `
      )
      .eq("active", true);

    if (cartsError) {
      throw cartsError;
    }

    if (!carts || carts.length === 0) {
      return Response.json(
        {
          success: false,

          error:
            "Actualmente no hay Coffee Carts disponibles.",
        },
        {
          status: 409,
        }
      );
    }

    // ============================================
    // CONSULTAR RESERVACIONES DE ESE DÍA
    // ============================================

    const {
      data: bookings,
      error: bookingsError,
    } = await supabaseAdmin
      .from("bookings")
      .select(
        `
        id,
        coffee_cart_id,
        start_time,
        duration_hours,
        status,
        hold_expires_at
        `
      )
      .eq("event_date", eventDate)
      .in("status", [
        "HOLD",
        "PAYMENT_PENDING",
        "CONFIRMED",
      ]);

    if (bookingsError) {
      throw bookingsError;
    }

    // ============================================
    // BLOQUE DE TIEMPO
    // ============================================

    const setupBufferMinutes = 90;
    const teardownBufferMinutes = 60;

    const requestedStart =
      timeToMinutes(startTime);

    const requestedEnd =
      requestedStart +
      numberHours * 60;

    const requestedBlockStart =
      requestedStart -
      setupBufferMinutes;

    const requestedBlockEnd =
      requestedEnd +
      teardownBufferMinutes;

    const now = new Date();

    // ============================================
    // ENCONTRAR UN CART DISPONIBLE
    // ============================================

    let availableCart = null;

    for (const cart of carts) {
      const cartBookings =
        bookings?.filter((booking) => {
          if (
            booking.coffee_cart_id !==
            cart.id
          ) {
            return false;
          }

          // Los HOLD vencidos ya no bloquean.
          if (
            booking.status === "HOLD" &&
            booking.hold_expires_at
          ) {
            const expiration = new Date(
              booking.hold_expires_at
            );

            if (expiration <= now) {
              return false;
            }
          }

          return true;
        }) || [];

      const hasConflict =
        cartBookings.some((booking) => {
          const bookingStart =
            timeToMinutes(
              booking.start_time
            );

          const bookingEnd =
            bookingStart +
            Number(
              booking.duration_hours
            ) *
              60;

          const existingBlockStart =
            bookingStart -
            setupBufferMinutes;

          const existingBlockEnd =
            bookingEnd +
            teardownBufferMinutes;

          return rangesOverlap(
            requestedBlockStart,
            requestedBlockEnd,

            existingBlockStart,
            existingBlockEnd
          );
        });

      if (!hasConflict) {
        availableCart = cart;
        break;
      }
    }

    // ============================================
    // NO HAY DISPONIBILIDAD
    // ============================================

    if (!availableCart) {
      return Response.json(
        {
          success: false,

          error:
            "Ese horario acaba de dejar de estar disponible. Selecciona otra fecha u hora.",
        },
        {
          status: 409,
        }
      );
    }

    // ============================================
    // CREAR HOLD DE 15 MINUTOS
    // ============================================

    const holdMinutes = 15;

    const holdExpiresAt = new Date(
      Date.now() +
        holdMinutes * 60 * 1000
    ).toISOString();

    const {
      data: booking,
      error: insertError,
    } = await supabaseAdmin
      .from("bookings")
      .insert({
        customer_name:
          customerName.trim(),

        email:
          email.trim().toLowerCase(),

        phone:
          phone.trim(),

        event_type:
          eventType.trim() || null,

        city:
          serviceArea.city,

        state:
          serviceArea.state,

        event_address:
          eventAddress.trim() || null,

        event_date:
          eventDate,

        start_time:
          startTime,

        duration_hours:
          numberHours,

        guests:
          numberGuests,

        package_name:
          "Java Coffee Cart",

        matcha_bar:
          Boolean(matchaBar),

        extra_barista:
          Boolean(extraBarista),

        total:
          quote.total,

        deposit:
          quote.deposit,

        balance:
          quote.balance,

        status:
          "HOLD",

        hold_expires_at:
          holdExpiresAt,

        coffee_cart_id:
          availableCart.id,
      })
      .select(
        `
        id,
        event_date,
        start_time,
        duration_hours,
        guests,
        total,
        deposit,
        balance,
        status,
        hold_expires_at
        `
      )
      .single();

    if (insertError) {
      throw insertError;
    }

    // ============================================
    // RESPUESTA
    // ============================================

    return Response.json({
      success: true,

      message:
        "Tu fecha ha sido apartada temporalmente.",

      hold: {
        bookingId:
          booking.id,

        expiresAt:
          booking.hold_expires_at,

        minutes:
          holdMinutes,
      },

      serviceArea: {
        city:
          serviceArea.city,

        state:
          serviceArea.state,
      },

      event: {
        date:
          booking.event_date,

        startTime:
          booking.start_time,

        hours:
          booking.duration_hours,

        guests:
          booking.guests,
      },

      quote: {
        total:
          Number(booking.total),

        deposit:
          Number(booking.deposit),

        balance:
          Number(booking.balance),

        currency:
          "MXN",
      },

      cart: {
        id:
          availableCart.id,

        code:
          availableCart.code,
      },
    });
  } catch (error) {
    console.error(
      "Hold API error:",
      error
    );

    return Response.json(
      {
        success: false,

        error:
          error.message ||
          "No fue posible apartar el evento.",
      },
      {
        status: 500,
      }
    );
  }
}