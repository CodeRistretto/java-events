import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { normalizeMexicoPhone } from "@/lib/phone";

function validEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || "").trim());
}

export async function POST(request) {
  try {
    const body = await request.json();
    const customerName = String(body.customerName || "").trim();
    const email = String(body.email || "").trim().toLowerCase();
    const phone = normalizeMexicoPhone(body.phone);

    if (!customerName) throw new Error("Escribe tu nombre completo.");
    if (!validEmail(email)) throw new Error("Ingresa un correo válido.");
    if (!phone) throw new Error("Ingresa un teléfono mexicano válido de 10 dígitos.");

    const row = {
      service_area_id: body.serviceAreaId || null,
      customer_name: customerName,
      email,
      phone,
      guest_count: Number(body.guestCount || 0) || null,
      start_time: body.startTime || null,
      end_time: body.endTime || null,
      duration_hours: Number(body.durationHours || 0) || null,
      quote_total_cents: Number(body.quoteTotalCents || 0) || null,
      quote_deposit_cents: Number(body.quoteDepositCents || 0) || null,
      quote_balance_cents: Number(body.quoteBalanceCents || 0) || null,
      status: "QUOTED",
      source: "JAVA_EVENTS_QUOTE",
      metadata: {
        selectedAddOns: Array.isArray(body.selectedAddOns) ? body.selectedAddOns : [],
      },
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabaseAdmin
      .from("event_leads")
      .insert(row)
      .select("id,created_at")
      .single();

    if (error) throw error;

    return Response.json({ success: true, leadId: data.id, createdAt: data.created_at });
  } catch (error) {
    return Response.json(
      { success: false, error: error.message || "No fue posible guardar tus datos." },
      { status: 400 }
    );
  }
}
