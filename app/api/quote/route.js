import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { calculateEventPrice } from "@/lib/pricing";

export async function POST(request) {
  try {
    const body = await request.json();

    const {
      city,
      guests,
      hours,
      matchaBar = false,
      extraBarista = false,
    } = body;

    if (!city) {
      return Response.json(
        {
          success: false,
          error: "Debes seleccionar una ciudad",
        },
        { status: 400 }
      );
    }

    const { data: serviceArea, error: areaError } =
      await supabaseAdmin
        .from("service_areas")
        .select("id, city, state, active")
        .eq("city", city)
        .eq("active", true)
        .maybeSingle();

    if (areaError) {
      throw areaError;
    }

    if (!serviceArea) {
      return Response.json(
        {
          success: false,
          error:
            "Java Coffee Cart todavía no está disponible en esta ciudad.",
        },
        { status: 400 }
      );
    }

    const quote = calculateEventPrice({
      guests,
      hours,
      matchaBar,
      extraBarista,
    });

    return Response.json({
      success: true,
      serviceArea: {
        city: serviceArea.city,
        state: serviceArea.state,
      },
      quote,
    });

  } catch (error) {
    return Response.json(
      {
        success: false,
        error: error.message,
      },
      { status: 500 }
    );
  }
}