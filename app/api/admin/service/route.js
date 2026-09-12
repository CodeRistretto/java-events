import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { requireAdmin } from "@/lib/adminAuth";
import { logAdminAction } from "@/lib/adminAudit";

function fail(error) {
  const status = error.status || (error.message === "UNAUTHORIZED" ? 401 : 500);
  return Response.json(
    { success: false, error: error.message === "UNAUTHORIZED" ? "Unauthorized" : error.message },
    { status }
  );
}

function cleanList(value) {
  const list = Array.isArray(value)
    ? value
    : String(value || "")
        .split("\n")
        .map((item) => item.trim())
        .filter(Boolean);
  return [...new Set(list.map((item) => String(item).trim()).filter(Boolean))];
}

export async function GET(request) {
  try {
    requireAdmin(request);

    const [settings, leads] = await Promise.all([
      supabaseAdmin.from("event_settings").select("*").eq("id", 1).single(),
      supabaseAdmin
        .from("event_leads")
        .select("id,customer_name,email,phone,guest_count,quote_total_cents,status,created_at")
        .order("created_at", { ascending: false })
        .limit(100),
    ]);

    if (settings.error) throw settings.error;
    if (leads.error) throw leads.error;

    return Response.json({ success: true, settings: settings.data, leads: leads.data || [] });
  } catch (error) {
    return fail(error);
  }
}

export async function POST(request) {
  try {
    const admin = requireAdmin(request);
    const body = await request.json();

    if (body.action !== "UPDATE_SERVICE_RULES") {
      return Response.json({ success: false, error: "Acción no soportada." }, { status: 400 });
    }

    const payload = body.payload || {};
    const { data: oldValue, error: oldError } = await supabaseAdmin
      .from("event_settings")
      .select("*")
      .eq("id", 1)
      .single();
    if (oldError) throw oldError;

    const patch = {
      cup_size_oz: Math.max(1, Number(payload.cupSizeOz || 12)),
      included_hot_drinks: cleanList(payload.hotDrinks),
      included_cold_drinks: cleanList(payload.coldDrinks),
      minimum_lead_days: Math.max(0, Number(payload.minimumLeadDays || 0)),
      balance_due_days_before: Math.max(0, Number(payload.balanceDueDaysBefore || 0)),
      cancellation_refund_bps: Math.max(
        0,
        Math.min(10000, Math.round(Number(payload.cancellationRefundPercent || 0) * 100))
      ),
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabaseAdmin
      .from("event_settings")
      .update(patch)
      .eq("id", 1)
      .select("*")
      .single();
    if (error) throw error;

    await logAdminAction({
      adminId: admin.username,
      action: "UPDATE_SERVICE_RULES",
      entityType: "event_settings",
      entityId: "1",
      oldValue,
      newValue: data,
    });

    return Response.json({ success: true, settings: data });
  } catch (error) {
    return fail(error);
  }
}
