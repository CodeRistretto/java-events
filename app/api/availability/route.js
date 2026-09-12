import { getDateAvailability } from "@/lib/eventInventory";
import { getEventSettings } from "@/lib/eventPricing";
import { assertMinimumLeadTime } from "@/lib/eventBookingRules";

export async function POST(request) {
  try {
    const body = await request.json();

    if (!body.serviceAreaId) {
      return Response.json(
        { success: false, error: "Selecciona una ciudad." },
        { status: 400 }
      );
    }

    if (!body.eventDate) {
      return Response.json(
        { success: false, error: "Selecciona una fecha." },
        { status: 400 }
      );
    }

    const settings = await getEventSettings();
    assertMinimumLeadTime(body.eventDate, settings.minimum_lead_days ?? 7);

    const result = await getDateAvailability(
      body.serviceAreaId,
      body.eventDate
    );

    const messages = {
      AVAILABLE: "Java Coffee Cart disponible para esta fecha.",
      TEMPORARILY_HELD:
        "La última unidad disponible está temporalmente reservada. Intenta de nuevo en unos minutos.",
      SOLD_OUT:
        "Esta fecha ya no está disponible para eventos de Java Coffee Cart. Selecciona otro día.",
      ADMIN_BLOCKED: "Esta fecha no está disponible.",
      MAINTENANCE:
        "El carrito asignado se encuentra en mantenimiento en esta fecha.",
    };

    return Response.json({
      success: true,
      available: result.available,
      availableCount: result.availableCount,
      dateState: result.state,
      message: messages[result.state],
      minimumLeadDays: Number(settings.minimum_lead_days ?? 7),
    });
  } catch (error) {
    return Response.json(
      {
        success: false,
        error: error.message || "No fue posible verificar la fecha.",
      },
      { status: 400 }
    );
  }
}
