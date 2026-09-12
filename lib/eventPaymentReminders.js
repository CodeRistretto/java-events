import { sendJavaEventEmail } from "@/lib/eventAppEmail";
import {
  moneyMx,
  prettyEventDate,
  renderEventEmailTemplate,
} from "@/lib/eventEmailTemplates";
import { getEventFinancialSummary } from "@/lib/eventPayments";
import { ensureAutomatedBalanceDraft } from "@/lib/shopifyBalanceAuto";
import { sendDraftOrderInvoiceEmail } from "@/lib/shopifyInvoiceEmail";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

function addDays(value, days) {
  const d = new Date(`${value}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function diffDays(a, b) {
  return Math.floor(
    (Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86400000
  );
}

function dateFromIsoDateTime(value) {
  return String(value || "").slice(0, 10);
}

async function claimBookingReminder({ booking, reminderKey, emailType, metadata = {} }) {
  const { data, error } = await supabaseAdmin
    .from("event_email_log")
    .insert({
      booking_id: booking.id,
      reminder_key: reminderKey,
      email_type: `PENDING_${emailType}`,
      recipient: booking.email,
      metadata: { ...metadata, sending: true },
    })
    .select("id")
    .single();

  if (error?.code === "23505") return null;
  if (error) throw error;
  return data?.id || null;
}

async function claimLeadReminder({ lead, reminderKey, emailType, metadata = {} }) {
  const { data, error } = await supabaseAdmin
    .from("event_lead_email_log")
    .insert({
      lead_id: lead.id,
      reminder_key: reminderKey,
      email_type: `PENDING_${emailType}`,
      recipient: lead.email,
      metadata: { ...metadata, sending: true },
    })
    .select("id")
    .single();

  if (error?.code === "23505") return null;
  if (error) throw error;
  return data?.id || null;
}

async function loadAutomationConfig() {
  const [settingsResult, templatesResult, rulesResult] = await Promise.all([
    supabaseAdmin
      .from("event_settings")
      .select("balance_due_days_before,lead_followup_months,lead_followup_interval_days")
      .eq("id", 1)
      .single(),
    supabaseAdmin.from("event_email_templates").select("*").eq("active", true),
    supabaseAdmin
      .from("event_email_rules")
      .select("*")
      .eq("active", true)
      .order("sort_order", { ascending: true }),
  ]);

  const error = settingsResult.error || templatesResult.error || rulesResult.error;
  if (error) throw error;

  return {
    settings: settingsResult.data,
    templates: Object.fromEntries(
      (templatesResult.data || []).map((item) => [item.code, item])
    ),
    rules: rulesResult.data || [],
  };
}

async function runBalanceRules({ today, settings, templates, rules, report }) {
  const balanceRules = rules.filter(
    (rule) => rule.trigger_type === "EVENT_DATE_OFFSET"
  );
  if (!balanceRules.length) return;

  const maxOffset = Math.max(
    ...balanceRules.map((rule) => Number(rule.offset_days || 0)),
    0
  );

  const { data: bookings, error } = await supabaseAdmin
    .from("bookings")
    .select("*")
    .in("status", ["CONFIRMED", "PREPARATION"])
    .not("shopify_order_id", "is", null)
    .gte("event_date", today)
    .lte("event_date", addDays(today, maxOffset));
  if (error) throw error;

  const dueDays = Number(settings.balance_due_days_before ?? 3);
  const baseUrl = process.env.APP_BASE_URL || "http://localhost:3000";

  for (const booking of bookings || []) {
    const daysUntil = diffDays(today, booking.event_date);
    const matchingRules = balanceRules.filter(
      (rule) => Number(rule.offset_days) === daysUntil
    );

    for (const rule of matchingRules) {
      const reminderKey = rule.code;
      let claimId = null;

      try {
        const { summary } = await getEventFinancialSummary(booking);
        if (rule.requires_balance_pending && summary.remainingCents <= 0) {
          report.skipped.push({ bookingId: booking.id, reminderKey, reason: "fully-paid" });
          continue;
        }

        const template = templates[rule.template_code];
        if (!template) {
          report.skipped.push({ bookingId: booking.id, reminderKey, reason: "template-disabled" });
          continue;
        }

        claimId = await claimBookingReminder({
          booking,
          reminderKey,
          emailType: rule.provider,
          metadata: { days_until_event: daysUntil, rule_code: rule.code },
        });
        if (!claimId) {
          report.skipped.push({ bookingId: booking.id, reminderKey, reason: "already-sent-or-in-progress" });
          continue;
        }

        const dueDate = addDays(booking.event_date, -dueDays);
        const rendered = renderEventEmailTemplate(template, {
          customer_name: booking.customer_name,
          event_ref: booking.event_order_number || booking.id,
          event_date: prettyEventDate(booking.event_date),
          remaining: moneyMx(summary.remainingCents),
          due_date: prettyEventDate(dueDate),
          confirmation_url: `${baseUrl}/confirmation/${booking.id}`,
          quote_url: baseUrl,
        });

        if (rule.provider !== "SHOPIFY_INVOICE") {
          throw new Error(`Proveedor de regla de saldo no soportado: ${rule.provider}`);
        }

        const draft = await ensureAutomatedBalanceDraft(booking);
        if (draft.alreadyPaid) {
          await supabaseAdmin.from("event_email_log").delete().eq("id", claimId);
          report.skipped.push({ bookingId: booking.id, reminderKey, reason: "fully-paid" });
          continue;
        }

        const sent = await sendDraftOrderInvoiceEmail({
          draftOrderId: draft.draftOrderId,
          to: booking.email,
          subject: rendered.subject,
          customMessage: rendered.body,
        });

        const { error: logError } = await supabaseAdmin
          .from("event_email_log")
          .update({
            email_type: "SHOPIFY_BALANCE_INVOICE",
            subject: rendered.subject,
            shopify_draft_order_id: draft.draftOrderId,
            invoice_url: sent.invoiceUrl || draft.invoiceUrl,
            sent_at: sent.invoiceSentAt || new Date().toISOString(),
            metadata: {
              days_until_event: daysUntil,
              due_date: dueDate,
              remaining_cents: summary.remainingCents,
              rule_code: rule.code,
              sending: false,
            },
          })
          .eq("id", claimId);
        if (logError) throw logError;

        await supabaseAdmin.from("event_timeline").insert({
          booking_id: booking.id,
          event_type: "BALANCE_REMINDER_SENT",
          title: `${rule.name} · correo Shopify enviado`,
          actor: "automation",
          metadata: {
            reminder_key: reminderKey,
            remaining_cents: summary.remainingCents,
          },
        });

        report.sent.push({ bookingId: booking.id, reminderKey });
      } catch (errorItem) {
        if (claimId) {
          await supabaseAdmin.from("event_email_log").delete().eq("id", claimId);
        }
        report.errors.push({ bookingId: booking.id, reminderKey, error: errorItem.message });
      }
    }
  }
}

async function runLeadReactivationRules({ today, templates, rules, report }) {
  const recurringRules = rules.filter(
    (rule) =>
      rule.trigger_type === "LEAD_AGE_INTERVAL" ||
      rule.trigger_type === "BOOKING_AGE_INTERVAL"
  );
  if (!recurringRules.length) return;

  const { data: leads, error } = await supabaseAdmin
    .from("event_leads")
    .select("*")
    .eq("marketing_consent", true)
    .order("created_at", { ascending: true })
    .limit(500);
  if (error) throw error;
  if (!leads?.length) return;

  // If this email has already converted into a paid event, stop prospecting.
  const emails = [...new Set(leads.map((lead) => lead.email).filter(Boolean))];
  let paidEmails = new Set();
  if (emails.length) {
    const { data: paidBookings, error: paidError } = await supabaseAdmin
      .from("bookings")
      .select("email")
      .in("email", emails)
      .not("shopify_order_id", "is", null);
    if (paidError) throw paidError;
    paidEmails = new Set(
      (paidBookings || []).map((item) => String(item.email || "").toLowerCase())
    );
  }

  const baseUrl = process.env.APP_BASE_URL || "http://localhost:3000";

  for (const lead of leads) {
    if (paidEmails.has(String(lead.email || "").toLowerCase())) {
      report.skipped.push({ leadId: lead.id, reason: "converted-to-paid-booking" });
      continue;
    }

    const createdDate = dateFromIsoDateTime(lead.created_at);
    const ageDays = diffDays(createdDate, today);
    if (ageDays < 1) continue;

    for (const rule of recurringRules) {
      if (rule.requires_marketing_consent && !lead.marketing_consent) continue;

      const interval = Math.max(1, Number(rule.interval_days || 30));
      const maxSends = Math.max(1, Number(rule.max_sends || 1));
      const occurrence = Math.floor(ageDays / interval);
      if (occurrence < 1 || occurrence > maxSends) continue;

      const reminderKey = `${rule.code}_${occurrence}`;
      let claimId = null;

      try {
        const template = templates[rule.template_code];
        if (!template) {
          report.skipped.push({ leadId: lead.id, reminderKey, reason: "template-disabled" });
          continue;
        }

        claimId = await claimLeadReminder({
          lead,
          reminderKey,
          emailType: rule.provider,
          metadata: { occurrence, age_days: ageDays, rule_code: rule.code },
        });
        if (!claimId) continue;

        const rendered = renderEventEmailTemplate(template, {
          customer_name: lead.customer_name,
          event_ref: lead.id,
          event_date: "",
          total: moneyMx(lead.quote_total_cents),
          deposit: moneyMx(lead.quote_deposit_cents),
          remaining: moneyMx(lead.quote_balance_cents),
          quote_url: baseUrl,
          confirmation_url: baseUrl,
          unsubscribe_url: lead.email_unsubscribe_token
            ? `${baseUrl}/unsubscribe/${lead.email_unsubscribe_token}`
            : baseUrl,
        });

        if (rule.provider !== "APP_EMAIL") {
          throw new Error(`Proveedor de reactivación no soportado: ${rule.provider}`);
        }

        const sent = await sendJavaEventEmail({
          to: lead.email,
          subject: rendered.subject,
          body: rendered.body,
        });

        if (!sent.sent) {
          await supabaseAdmin.from("event_lead_email_log").delete().eq("id", claimId);
          report.skipped.push({
            leadId: lead.id,
            reminderKey,
            reason: sent.reason || "email-provider-not-configured",
          });
          continue;
        }

        const { error: logError } = await supabaseAdmin
          .from("event_lead_email_log")
          .update({
            email_type: "APP_EMAIL_REACTIVATION",
            subject: rendered.subject,
            sent_at: new Date().toISOString(),
            metadata: {
              occurrence,
              age_days: ageDays,
              rule_code: rule.code,
              provider_id: sent.providerId || null,
              sending: false,
            },
          })
          .eq("id", claimId);
        if (logError) throw logError;

        report.sent.push({ leadId: lead.id, reminderKey });
      } catch (errorItem) {
        if (claimId) {
          await supabaseAdmin.from("event_lead_email_log").delete().eq("id", claimId);
        }
        report.errors.push({ leadId: lead.id, reminderKey, error: errorItem.message });
      }
    }
  }
}

export async function runEventPaymentReminders(today) {
  const report = { sent: [], skipped: [], errors: [] };
  const { settings, templates, rules } = await loadAutomationConfig();

  await runBalanceRules({ today, settings, templates, rules, report });
  await runLeadReactivationRules({ today, templates, rules, report });

  return report;
}
