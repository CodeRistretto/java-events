import { sendJavaEventEmail } from "@/lib/eventAppEmail";
import { moneyMx, prettyEventDate, renderEventEmailTemplate } from "@/lib/eventEmailTemplates";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function sendReservationReceivedEmail(booking) {
  if (!booking?.id || !booking?.email) return { sent: false, skipped: true };

  const { data: existing } = await supabaseAdmin
    .from("event_email_log")
    .select("id")
    .eq("booking_id", booking.id)
    .eq("reminder_key", "RESERVATION_CREATED")
    .maybeSingle();

  if (existing) return { sent: false, skipped: true, reason: "ALREADY_SENT" };

  const { data: template, error } = await supabaseAdmin
    .from("event_email_templates")
    .select("*")
    .eq("code", "RESERVATION_UNPAID")
    .eq("active", true)
    .maybeSingle();

  if (error) throw error;
  if (!template) return { sent: false, skipped: true, reason: "TEMPLATE_DISABLED" };

  const baseUrl = process.env.APP_BASE_URL || "http://localhost:3000";
  const totalCents = Number(booking.total_cents || Math.round(Number(booking.total || 0) * 100));
  const depositCents = Number(booking.deposit_cents || Math.round(Number(booking.deposit || 0) * 100));

  const rendered = renderEventEmailTemplate(template, {
    customer_name: booking.customer_name,
    event_ref: booking.event_order_number || booking.id,
    event_date: prettyEventDate(booking.event_date),
    total: moneyMx(totalCents),
    deposit: moneyMx(depositCents),
    confirmation_url: `${baseUrl}/confirmation/${booking.id}`,
    quote_url: baseUrl,
  });

  const sent = await sendJavaEventEmail({
    to: booking.email,
    subject: rendered.subject,
    body: rendered.body,
  });

  if (!sent.sent) return sent;

  await supabaseAdmin.from("event_email_log").insert({
    booking_id: booking.id,
    reminder_key: "RESERVATION_CREATED",
    email_type: "RESERVATION_UNPAID",
    recipient: booking.email,
    subject: rendered.subject,
    metadata: {
      provider: "APP_EMAIL",
      provider_id: sent.providerId || null,
    },
  });

  await supabaseAdmin
    .from("bookings")
    .update({ reservation_notice_sent_at: new Date().toISOString() })
    .eq("id", booking.id);

  await supabaseAdmin.from("event_timeline").insert({
    booking_id: booking.id,
    event_type: "RESERVATION_EMAIL_SENT",
    title: "Correo de solicitud recibida enviado",
    actor: "automation",
    metadata: { provider_id: sent.providerId || null },
  });

  return sent;
}
