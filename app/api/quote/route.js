import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { calculateEventPrice } from "@/lib/pricing";

export async function POST(request) {
  try {
    const body = await request.json();

    const {
      serviceAreaId,
      guests,
      hours,
      matchaBar = false,
      extraBarista = false,
    } = body;

    // ============================================
    // VALIDACIONES
    // ============================================

    if (!serviceAreaId) {
      return Response.json(
        {
          success: false,
          error: "Debes seleccionar una ciudad",
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
          error: "Número de invitados inválido",
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
          error: "Duración del evento inválida",
        },
        {
          status: 400,
        }
      );
    }

    // ============================================
    // BUSCAR ZONA DE SERVICIO EN SUPABASE
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
      console.error(
        "Supabase service area error:",
        serviceAreaError
      );

      return Response.json(
        {
          success: false,
          error:
            "No fue posible verificar la zona de servicio.",
        },
        {
          status: 500,
        }
      );
    }

    // ============================================
    // CIUDAD NO AUTORIZADA
    // ============================================

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
    // CALCULAR PRECIO
    // ============================================

    const quote = calculateEventPrice({
      guests: numberGuests,
      hours: numberHours,
      matchaBar,
      extraBarista,
    });

    // ============================================
    // RESPUESTA
    // ============================================

    return Response.json({
      success: true,

      serviceArea: {
        id: serviceArea.id,
        city: serviceArea.city,
        state: serviceArea.state,
      },

      quote: {
        total: quote.total,
        deposit: quote.deposit,
        balance: quote.balance,
        currency: quote.currency,
      },
    });
  } catch (error) {
    console.error("Quote API error:", error);

    return Response.json(
      {
        success: false,
        error:
          error.message ||
          "Ocurrió un error al calcular la cotización.",
      },
      {
        status: 500,
      }
    );
  }
}