import { supabaseAdmin } from "@/lib/supabaseAdmin";

function timeToMinutes(time) {
  const [hours, minutes] = time.split(":").map(Number);

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
      hours,
    } = body;

    if (!serviceAreaId) {
      return Response.json(
        {
          success: false,
          error: "Debes seleccionar una ciudad.",
        },
        { status: 400 }
      );
    }

    if (!eventDate) {
      return Response.json(
        {
          success: false,
          error: "Debes seleccionar una fecha.",
        },
        { status: 400 }
      );
    }

    if (!startTime) {
      return Response.json(
        {
          success: false,
          error: "Debes seleccionar una hora.",
        },
        { status: 400 }
      );
    }

    const durationHours = Number(hours);

    if (!durationHours || durationHours < 1) {
      return Response.json(
        {
          success: false,
          error: "Duración inválida.",
        },
        { status: 400 }
      );
    }

    // ============================================
    // VALIDAR CIUDAD
    // ============================================

    const {
      data: serviceArea,
      error: serviceAreaError,
    } = await supabaseAdmin
      .from("service_areas")
      .select("id, city, state")
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
        { status: 400 }
      );
    }

    // ============================================
    // BUSCAR CARRITOS ACTIVOS
    // ============================================

    const {
      data: carts,
      error: cartsError,
    } = await supabaseAdmin
      .from("coffee_carts")
      .select("id, name, code")
      .eq("active", true);

    if (cartsError) {
      throw cartsError;
    }

    if (!carts || carts.length === 0) {
      return Response.json(
        {
          success: true,
          available: false,
          error:
            "Actualmente no hay Coffee Carts disponibles.",
        }
      );
    }

    // ============================================
    // OBTENER RESERVAS DE ESE DÍA
    // ============================================

    const {
      data: bookings,
      error: bookingsError,
    } = await supabaseAdmin
      .from("bookings")
      .select(`
        id,
        coffee_cart_id,
        start_time,
        duration_hours,
        status,
        hold_expires_at
      `)
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
    // HORARIO SOLICITADO
    // ============================================

    const setupBuffer = 90;
    const teardownBuffer = 60;

    const eventStart =
      timeToMinutes(startTime);

    const eventEnd =
      eventStart +
      durationHours * 60;

    const requestedBlockStart =
      eventStart - setupBuffer;

    const requestedBlockEnd =
      eventEnd + teardownBuffer;

    const now = new Date();

    // ============================================
    // BUSCAR UN CARRITO DISPONIBLE
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

          // Ignorar HOLD vencidos
          if (
            booking.status === "HOLD" &&
            booking.hold_expires_at
          ) {
            const expiration = new Date(
              booking.hold_expires_at
            );

            if (expiration < now) {
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
            setupBuffer;

          const existingBlockEnd =
            bookingEnd +
            teardownBuffer;

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
    // RESULTADO
    // ============================================

    if (!availableCart) {
      return Response.json({
        success: true,
        available: false,

        message:
          "No hay un Java Coffee Cart disponible en ese horario.",
      });
    }

    return Response.json({
      success: true,

      available: true,

      serviceArea: {
        city: serviceArea.city,
        state: serviceArea.state,
      },

      cart: {
        id: availableCart.id,
        name: availableCart.name,
        code: availableCart.code,
      },

      event: {
        date: eventDate,
        startTime,
        hours: durationHours,
      },

      buffers: {
        setupMinutes: setupBuffer,
        teardownMinutes:
          teardownBuffer,
      },
    });
  } catch (error) {
    console.error(
      "Availability API error:",
      error
    );

    return Response.json(
      {
        success: false,

        error:
          error.message ||
          "No fue posible verificar la disponibilidad.",
      },

      {
        status: 500,
      }
    );
  }
}