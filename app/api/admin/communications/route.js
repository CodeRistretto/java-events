import { requireAdmin } from "@/lib/adminAuth";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";

export async function GET(request) {
  try {
    requireAdmin(request);

    const [{ data: logs, error: logsError }, { data: settings, error: settingsError }] = await Promise.all([
      supabaseAdmin
        .from("event_email_log")
        .select("*")
        .order("sent_at", { ascending: false })
        .limit(100),
      supabaseAdmin
        .from("event_settings")
        .select("balance_due_days_before")
        .eq("id", 1)
        .single(),
    ]);

    if (logsError) throw logsError;
    if (settingsError) throw settingsError;

    const ids = [...new Set((logs || []).map((item) => item.booking_id))];
    let bookings = [];

    if (ids.length) {
      const result = await supabaseAdmin
        .from("bookings")
        .select("id,event_order_number,customer_name,email,event_date,status")
        .in("id", ids);
      if (result.error) throw result.error;
      bookings = result.data || [];
    }

    const bookingMap = Object.fromEntries(bookings.map((item) => [item.id, item]));

    return Response.json({
      success: true,
      settings,
      logs: (logs || []).map((item) => ({ ...item, booking: bookingMap[item.booking_id] || null })),
    });
  } catch (error) {
    const status = error?.status || (error?.message === "UNAUTHORIZED" ? 401 : 500);
    return Response.json(
      { success: false, error: error?.message === "UNAUTHORIZED" ? "Unauthorized" : error?.message },
      { status }
    );
  }
}
