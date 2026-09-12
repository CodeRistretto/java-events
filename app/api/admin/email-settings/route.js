import { requireAdmin } from "@/lib/adminAuth";
import { logAdminAction } from "@/lib/adminAudit";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";

function fail(error) {
  const status = error?.status || (error?.message === "UNAUTHORIZED" ? 401 : 500);
  return Response.json(
    {
      success: false,
      error:
        error?.message === "UNAUTHORIZED"
          ? "Unauthorized"
          : error?.message || "Error inesperado.",
    },
    { status }
  );
}

function code(value) {
  return String(value || "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9_]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

export async function GET(request) {
  try {
    requireAdmin(request);

    const [templates, rules] = await Promise.all([
      supabaseAdmin
        .from("event_email_templates")
        .select("*")
        .order("name", { ascending: true }),
      supabaseAdmin
        .from("event_email_rules")
        .select("*")
        .order("sort_order", { ascending: true }),
    ]);

    if (templates.error) throw templates.error;
    if (rules.error) throw rules.error;

    return Response.json({
      success: true,
      providerConfigured: Boolean(
        process.env.RESEND_API_KEY && process.env.EVENTS_FROM_EMAIL
      ),
      templates: templates.data || [],
      rules: rules.data || [],
    });
  } catch (error) {
    return fail(error);
  }
}

export async function POST(request) {
  try {
    const admin = requireAdmin(request);
    const body = await request.json();
    const action = body.action;
    const payload = body.payload || {};

    if (action === "SAVE_TEMPLATE") {
      const templateCode = code(payload.code);
      if (!templateCode) throw new Error("La plantilla necesita un código.");
      if (!String(payload.name || "").trim()) throw new Error("La plantilla necesita un nombre.");
      if (!String(payload.subjectTemplate || "").trim()) throw new Error("Escribe el asunto.");
      if (!String(payload.bodyTemplate || "").trim()) throw new Error("Escribe el cuerpo del correo.");

      const row = {
        code: templateCode,
        name: String(payload.name).trim(),
        subject_template: String(payload.subjectTemplate).trim(),
        body_template: String(payload.bodyTemplate).trim(),
        active: payload.active !== false,
        updated_at: new Date().toISOString(),
      };

      const { data, error } = await supabaseAdmin
        .from("event_email_templates")
        .upsert(row, { onConflict: "code" })
        .select("*")
        .single();
      if (error) throw error;

      await logAdminAction({
        adminId: admin.username,
        action: "SAVE_EMAIL_TEMPLATE",
        entityType: "event_email_templates",
        entityId: templateCode,
        oldValue: null,
        newValue: data,
      });

      return Response.json({ success: true, template: data });
    }

    if (action === "SAVE_RULE") {
      const ruleCode = code(payload.code);
      const provider = String(payload.provider || "APP_EMAIL").toUpperCase();
      const triggerType = String(payload.triggerType || "").toUpperCase();

      if (!ruleCode) throw new Error("La automatización necesita un código.");
      if (!String(payload.name || "").trim()) throw new Error("La automatización necesita un nombre.");
      if (!String(payload.templateCode || "").trim()) throw new Error("Selecciona una plantilla.");
      if (!["SHOPIFY_INVOICE", "APP_EMAIL"].includes(provider)) {
        throw new Error("Proveedor de correo no válido.");
      }
      if (!["EVENT_DATE_OFFSET", "LEAD_AGE_INTERVAL", "BOOKING_AGE_INTERVAL"].includes(triggerType)) {
        throw new Error("Tipo de automatización no válido.");
      }

      const intervalTrigger = ["LEAD_AGE_INTERVAL", "BOOKING_AGE_INTERVAL"].includes(triggerType);

      const row = {
        code: ruleCode,
        name: String(payload.name).trim(),
        template_code: String(payload.templateCode).trim(),
        provider,
        trigger_type: triggerType,
        offset_days:
          triggerType === "EVENT_DATE_OFFSET"
            ? Math.max(0, Number(payload.offsetDays || 0))
            : null,
        interval_days: intervalTrigger
          ? Math.max(1, Number(payload.intervalDays || 30))
          : null,
        max_sends: Math.max(1, Number(payload.maxSends || 1)),
        requires_deposit_paid: Boolean(payload.requiresDepositPaid),
        requires_balance_pending: Boolean(payload.requiresBalancePending),
        requires_marketing_consent: Boolean(payload.requiresMarketingConsent),
        active: payload.active !== false,
        sort_order: Number(payload.sortOrder || 100),
        updated_at: new Date().toISOString(),
      };

      let query = supabaseAdmin.from("event_email_rules");
      query = payload.id ? query.update(row).eq("id", payload.id) : query.insert(row);

      const { data, error } = await query.select("*").single();
      if (error) throw error;

      await logAdminAction({
        adminId: admin.username,
        action: "SAVE_EMAIL_RULE",
        entityType: "event_email_rules",
        entityId: data.id,
        oldValue: null,
        newValue: data,
      });

      return Response.json({ success: true, rule: data });
    }

    if (action === "DELETE_RULE") {
      const ruleId = body.ruleId;
      if (!ruleId) throw new Error("Falta ruleId.");

      const { data: oldValue, error: readError } = await supabaseAdmin
        .from("event_email_rules")
        .select("*")
        .eq("id", ruleId)
        .maybeSingle();
      if (readError) throw readError;
      if (!oldValue) throw new Error("Automatización no encontrada.");

      const { error } = await supabaseAdmin
        .from("event_email_rules")
        .delete()
        .eq("id", ruleId);
      if (error) throw error;

      await logAdminAction({
        adminId: admin.username,
        action: "DELETE_EMAIL_RULE",
        entityType: "event_email_rules",
        entityId: ruleId,
        oldValue,
        newValue: null,
      });

      return Response.json({ success: true });
    }

    return Response.json(
      { success: false, error: "Acción no soportada." },
      { status: 400 }
    );
  } catch (error) {
    return fail(error);
  }
}
