import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const [
      settingsResult,
      tiersResult,
      addOnsResult,
      areasResult,
      productResult,
    ] = await Promise.all([
      supabaseAdmin.from("event_settings").select("*").eq("id", 1).single(),
      supabaseAdmin
        .from("event_guest_tiers")
        .select("*")
        .eq("active", true)
        .is("effective_to", null)
        .order("guest_count"),
      supabaseAdmin
        .from("event_add_ons")
        .select("*")
        .eq("active", true)
        .is("effective_to", null)
        .order("group_name")
        .order("display_order"),
      supabaseAdmin
        .from("service_areas")
        .select("id,city,state,minimum_guests,transport_fee_cents,activation_at,deactivation_at")
        .eq("active", true)
        .order("city"),
      supabaseAdmin
        .from("event_products")
        .select("*")
        .eq("code", "JAVA_COFFEE_CART")
        .eq("active", true)
        .single(),
    ]);

    const error =
      settingsResult.error ||
      tiersResult.error ||
      addOnsResult.error ||
      areasResult.error ||
      productResult.error;

    if (error) throw error;

    const now = Date.now();

    const serviceAreas = (areasResult.data || []).filter((area) => {
      if (area.activation_at && new Date(area.activation_at).getTime() > now) return false;
      if (area.deactivation_at && new Date(area.deactivation_at).getTime() <= now) return false;
      return true;
    });

    return Response.json({
      success: true,
      settings: settingsResult.data,
      guestTiers: tiersResult.data || [],
      addOns: addOnsResult.data || [],
      serviceAreas,
      product: productResult.data,
    });
  } catch (error) {
    return Response.json(
      {
        success: false,
        error: error.message || "No fue posible cargar la configuración de Events.",
      },
      { status: 500 }
    );
  }
}
