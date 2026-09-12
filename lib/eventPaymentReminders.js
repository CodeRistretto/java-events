import { getEventFinancialSummary } from "@/lib/eventPayments";
import { ensureAutomatedBalanceDraft } from "@/lib/shopifyBalanceAuto";
import { sendDraftOrderInvoiceEmail } from "@/lib/shopifyInvoiceEmail";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

const DAYS = [15, 7, 6, 5, 4, 3];

function addDays(value, days) {
  const d = new Date(`${value}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function diffDays(a, b) {
  return Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86400000);
}

function mxn(cents) {
  return new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(Number(cents || 0) / 100);
}

function pretty(value) {
  return new Intl.DateTimeFormat("es-MX", { timeZone: "UTC", day: "numeric", month: "long", year: "numeric" })
    .format(new Date(`${value}T12:00:00Z`));
}

export async function runEventPaymentReminders(today) {
  const report = { sent: [], skipped: [], errors: [] };
  const { data: settings, error: settingsError } = await supabaseAdmin
    .from("event_settings")
    .select("balance_due_days_before")
    .eq("id", 1)
    .single();
  if (settingsError) throw settingsError;

  const dueDays = Number(settings.balance_due_days_before ?? 3);
  const { data: bookings, error } = await supabaseAdmin
    .from("bookings")
    .select("*")
    .in("status", ["CONFIRMED", "PREPARATION"])
    .not("shopify_order_id", "is", null)
    .gte("event_date", today)
    .lte("event_date", addDays(today, 15));
  if (error) throw error;

  for (const booking of bookings || []) {
    const daysUntil = diffDays(today, booking.event_date);
    if (!DAYS.includes(daysUntil)) continue;
    const reminderKey = `BALANCE_D${daysUntil}`;

    const { data: previous } = await supabaseAdmin
      .from("event_email_log")
      .select("id")
      .eq("booking_id", booking.id)
      .eq("reminder_key", reminderKey)
      .maybeSingle();
    if (previous) {
      report.skipped.push({ bookingId: booking.id, reminderKey, reason: "already-sent" });
      continue;
    }

    try {
      const { summary } = await getEventFinancialSummary(booking);
      if (summary.remainingCents <= 0) {
        report.skipped.push({ bookingId: booking.id, reminderKey, reason: "fully-paid" });
        continue;
      }

      const draft = await ensureAutomatedBalanceDraft(booking);
      if (draft.alreadyPaid) continue;
      const dueDate = addDays(booking.event_date, -dueDays);
      const ref = booking.event_order_number || booking.id;
      const subject = daysUntil <= 3
        ? `Último día para liquidar tu evento Java · ${ref}`
        : `Tu evento Java se acerca · saldo pendiente ${mxn(summary.remainingCents)}`;
      const baseUrl = process.env.APP_BASE_URL || "http://localhost:3000";
      const message =
        `Hola ${booking.customer_name}. Tu evento Java Coffee Cart es el ${pretty(booking.event_date)}. ` +
        `Tu saldo pendiente es ${mxn(summary.remainingCents)} y vence el ${pretty(dueDate)}. ` +
        `Usa el botón de pago de esta factura de Shopify para liquidar. ` +
        `Confirmación: ${baseUrl}/confirmation/${booking.id}`;

      const sent = await sendDraftOrderInvoiceEmail({ draftOrderId: draft.draftOrderId, to: booking.email, subject, customMessage: message });

      const { error: logError } = await supabaseAdmin.from("event_email_log").insert({
        booking_id: booking.id,
        reminder_key: reminderKey,
        email_type: "SHOPIFY_BALANCE_INVOICE",
        recipient: booking.email,
        subject,
        shopify_draft_order_id: draft.draftOrderId,
        invoice_url: sent.invoiceUrl || draft.invoiceUrl,
        sent_at: sent.invoiceSentAt || new Date().toISOString(),
        metadata: { days_until_event: daysUntil, due_date: dueDate, remaining_cents: summary.remainingCents },
      });
      if (logError) throw logError;

      await supabaseAdmin.from("event_timeline").insert({
        booking_id: booking.id,
        event_type: "BALANCE_REMINDER_SENT",
        title: `Recordatorio Shopify enviado · faltan ${daysUntil} días`,
        actor: "automation",
        metadata: { reminder_key: reminderKey, remaining_cents: summary.remainingCents },
      });

      report.sent.push({ bookingId: booking.id, reminderKey });
    } catch (errorItem) {
      report.errors.push({ bookingId: booking.id, reminderKey, error: errorItem.message });
    }
  }

  return report;
}
