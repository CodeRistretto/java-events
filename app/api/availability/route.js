import { supabaseAdmin } from "@/lib/supabaseAdmin";

function timeToMinutes(time) {
  const [hours, minutes] = String(time)
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
    const body =
      await request.json();

    const {
      serviceAreaId,
      eventDate,
      startTime,
    } = body;

    // Compatibilidad:
    // acepta durationHours o hours.
    const durationHours =
      Number(
        body.durationHours ??
        body.hours
      );

    // ============================================
    // VALIDACIONES
    // ============================================

    if (!serviceAreaId) {
      return Response.json(
        {
          success: false,
          error:
            "Debes seleccionar una ciudad.",
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
            "Debes seleccionar una fecha.",
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
            "Debes seleccionar una hora.",
        },
        {
          status: 400,
        }
      );
    }

    if (
      !Number.isFinite(
        durationHours
      ) ||
      durationHours < 1
    ) {
      return Response.json(
        {
          success: false,
          error:
            "Duración inválida.",
        },
        {
          status: 400,
        }
      );
    }

    // ============================================
    // ZONA DE SERVICIO
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
      .eq(
        "id",
        serviceAreaId
      )
      .eq(
        "active",
        true
      )
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
    // BUSCAR CARRITOS ASIGNADOS A ESTA ZONA
    // ============================================

    const {
      data: assignments,
      error: assignmentsError,
    } = await supabaseAdmin
      .from(
        "coffee_cart_service_areas"
      )
      .select(
        "coffee_cart_id"
      )
      .eq(
        "service_area_id",
        serviceAreaId
      )
      .eq(
        "active",
        true
      );

    if (assignmentsError) {
      throw assignmentsError;
    }

    const cartIds =
      (assignments || [])
        .map(
          (assignment) =>
            assignment.coffee_cart_id
        )
        .filter(Boolean);

    if (cartIds.length === 0) {
      return Response.json({
        success: true,
        available: false,

        message:
          "Actualmente no hay un Java Coffee Cart asignado a esta zona.",
      });
    }

    // ============================================
    // OBTENER CARRITOS ACTIVOS
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
      .in(
        "id",
        cartIds
      )
      .eq(
        "active",
        true
      );

    if (cartsError) {
      throw cartsError;
    }

    if (!carts?.length) {
      return Response.json({
        success: true,
        available: false,

        message:
          "Actualmente no hay un Java Coffee Cart activo para esta zona.",
      });
    }

    // ============================================
    // RESERVACIONES DEL DÍA
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
      .eq(
        "event_date",
        eventDate
      )
      .in(
        "status",
        [
          "HOLD",
          "PAYMENT_PENDING",
          "CONFIRMED",
        ]
      );

    if (bookingsError) {
      throw bookingsError;
    }

    // ============================================
    // BUFFER OPERATIVO
    // ============================================

    const setupBufferMinutes =
      90;

    const teardownBufferMinutes =
      60;

    const requestedStart =
      timeToMinutes(
        startTime
      );

    const requestedEnd =
      requestedStart +
      durationHours * 60;

    const requestedBlockStart =
      requestedStart -
      setupBufferMinutes;

    const requestedBlockEnd =
      requestedEnd +
      teardownBufferMinutes;

    const now =
      new Date();

    // ============================================
    // BUSCAR CARRITO DISPONIBLE
    // ============================================

    let availableCart =
      null;

    for (
      const cart of carts
    ) {
      const cartBookings =
        (bookings || [])
          .filter(
            (booking) => {
              if (
                booking
                  .coffee_cart_id !==
                cart.id
              ) {
                return false;
              }

              // HOLD o PAYMENT_PENDING vencido
              // ya no bloquea el cart.
              if (
                (
                  booking.status ===
                    "HOLD" ||
                  booking.status ===
                    "PAYMENT_PENDING"
                ) &&
                booking
                  .hold_expires_at
              ) {
                const expiration =
                  new Date(
                    booking
                      .hold_expires_at
                  );

                if (
                  expiration <=
                  now
                ) {
                  return false;
                }
              }

              return true;
            }
          );

      const hasConflict =
        cartBookings.some(
          (booking) => {
            const existingStart =
              timeToMinutes(
                booking.start_time
              );

            const existingEnd =
              existingStart +
              Number(
                booking
                  .duration_hours
              ) *
                60;

            const existingBlockStart =
              existingStart -
              setupBufferMinutes;

            const existingBlockEnd =
              existingEnd +
              teardownBufferMinutes;

            return rangesOverlap(
              requestedBlockStart,
              requestedBlockEnd,

              existingBlockStart,
              existingBlockEnd
            );
          }
        );

      if (!hasConflict) {
        availableCart =
          cart;

        break;
      }
    }

    // ============================================
    // NO DISPONIBLE
    // ============================================

    if (!availableCart) {
      return Response.json({
        success: true,

        available: false,

        message:
          "Todos los Java Coffee Carts asignados a esta zona están ocupados en ese horario.",
      });
    }

    // ============================================
    // DISPONIBLE
    // ============================================

    return Response.json({
      success: true,

      available: true,

      serviceArea: {
        id:
          serviceArea.id,

        city:
          serviceArea.city,

        state:
          serviceArea.state,
      },

      cart: {
        id:
          availableCart.id,

        name:
          availableCart.name,

        code:
          availableCart.code,
      },

      event: {
        date:
          eventDate,

        startTime,

        hours:
          durationHours,

        durationHours:
          durationHours,
      },

      buffers: {
        setupMinutes:
          setupBufferMinutes,

        teardownMinutes:
          teardownBufferMinutes,
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