import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function page(title, message) {
  return new Response(
    `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${title}</title></head><body style="margin:0;background:#f5f5f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;color:#1d1d1f"><main style="max-width:620px;margin:80px auto;padding:20px"><div style="background:#fff;border:1px solid #e6e6e9;border-radius:24px;padding:32px"><div style="color:#f05a22;font-size:11px;font-weight:700;letter-spacing:.14em">JAVA TIMES CAFFÉ · EVENTS</div><h1 style="font-size:34px;letter-spacing:-.04em;margin:10px 0 14px">${title}</h1><p style="color:#6e6e73;line-height:1.65">${message}</p><a href="/" style="display:inline-block;margin-top:12px;padding:12px 18px;border-radius:999px;background:#f05a22;color:#fff;text-decoration:none;font-weight:600">Volver a Java Events</a></div></main></body></html>`,
    { headers: { "Content-Type": "text/html; charset=utf-8" } }
  );
}

export async function GET(_request, { params }) {
  const { token } = await params;

  const { data: booking, error } = await supabaseAdmin
    .from("bookings")
    .select("id")
    .eq("email_unsubscribe_token", token)
    .maybeSingle();

  if (error || !booking) {
    return page(
      "No encontramos esta preferencia",
      "El enlace puede haber expirado o no corresponde a una solicitud de Java Events."
    );
  }

  const { error: updateError } = await supabaseAdmin
    .from("bookings")
    .update({ marketing_consent: false })
    .eq("id", booking.id);

  if (updateError) {
    return page(
      "No pudimos actualizar tu preferencia",
      "Inténtalo nuevamente más tarde o comunícate con Java Times Caffé."
    );
  }

  return page(
    "Seguimiento cancelado",
    "Ya no recibirás los correos mensuales de seguimiento de esta cotización. Los correos necesarios para una reserva o pago activo pueden seguir enviándose cuando correspondan."
  );
}
