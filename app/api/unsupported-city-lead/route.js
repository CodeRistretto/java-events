import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function POST(request) {
  try {
    const body = await request.json();

    if (!body.city?.trim()) {
      return Response.json(
        { success: false, error: "Escribe la ciudad." },
        { status: 400 }
      );
    }

    const { error } = await supabaseAdmin
      .from("unsupported_city_leads")
      .insert({
        customer_name: body.customerName?.trim() || null,
        email: body.email?.trim().toLowerCase() || null,
        phone: body.phone?.trim() || null,
        city: body.city.trim(),
        state: body.state?.trim() || null,
        estimated_guests: body.estimatedGuests
          ? Number(body.estimatedGuests)
          : null,
        event_type: body.eventType?.trim() || null,
        expected_date: body.expectedDate || null,
        marketing_consent: Boolean(body.marketingConsent),
      });

    if (error) throw error;

    return Response.json({
      success: true,
      message:
        "Guardamos tu solicitud. Podremos avisarte cuando Java Coffee Cart llegue a tu ciudad.",
    });
  } catch (error) {
    return Response.json(
      {
        success: false,
        error: error.message || "No fue posible guardar la solicitud.",
      },
      { status: 500 }
    );
  }
}
