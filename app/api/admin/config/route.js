import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { requireAdmin } from "@/lib/adminAuth";
import { logAdminAction } from "@/lib/adminAudit";

function fail(error) {
  const status = error.status || (error.message === "UNAUTHORIZED" ? 401 : 500);
  return Response.json(
    {
      success: false,
      error: error.message === "UNAUTHORIZED" ? "Unauthorized" : error.message,
    },
    { status }
  );
}

async function postalCodeMap() {
  const { data, error } = await supabaseAdmin
    .from("service_area_postal_codes")
    .select("*")
    .eq("active", true);

  if (error) throw error;

  const map = {};
  for (const row of data || []) {
    map[row.service_area_id] ||= [];
    map[row.service_area_id].push(row.postal_code);
  }
  return map;
}

export async function GET(request) {
  try {
    requireAdmin(request);

    const [
      settings,
      tiers,
      addOns,
      areas,
      carts,
      orders,
      audit,
      postalCodes,
    ] = await Promise.all([
      supabaseAdmin.from("event_settings").select("*").eq("id", 1).single(),
      supabaseAdmin.from("event_guest_tiers").select("*").order("guest_count"),
      supabaseAdmin
        .from("event_add_ons")
        .select("*")
        .order("group_name")
        .order("display_order"),
      supabaseAdmin.from("service_areas").select("*").order("city"),
      supabaseAdmin.from("coffee_carts").select("*").order("code"),
      supabaseAdmin
        .from("bookings")
        .select(
          "id,event_order_number,customer_name,email,city,event_date,guests,total,status,confirmation_number,created_at"
        )
        .order("created_at", { ascending: false })
        .limit(100),
      supabaseAdmin
        .from("admin_audit_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50),
      postalCodeMap(),
    ]);

    const error =
      settings.error ||
      tiers.error ||
      addOns.error ||
      areas.error ||
      carts.error ||
      orders.error ||
      audit.error;

    if (error) throw error;

    return Response.json({
      success: true,
      settings: settings.data,
      guestTiers: tiers.data || [],
      addOns: addOns.data || [],
      serviceAreas: (areas.data || []).map((area) => ({
        ...area,
        postalCodes: postalCodes[area.id] || [],
      })),
      carts: carts.data || [],
      orders: orders.data || [],
      audit: audit.data || [],
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

    if (action === "UPDATE_SETTINGS") {
      const { data: oldValue } = await supabaseAdmin
        .from("event_settings")
        .select("*")
        .eq("id", 1)
        .single();

      const patch = {
        vat_bps: Number(payload.vat_bps),
        hold_minutes: Number(payload.hold_minutes),
        checkout_hold_minutes: Number(payload.checkout_hold_minutes),
        bank_transfer_hold_minutes: Number(payload.bank_transfer_hold_minutes),
        minimum_guests: Number(payload.minimum_guests),
        maximum_guests: Number(payload.maximum_guests),
        guest_increment: Number(payload.guest_increment),
        standard_duration_hours: Number(payload.standard_duration_hours),
        payment_mode: payload.payment_mode,
        deposit_bps: Number(payload.deposit_bps),
        loyalty_enabled: Boolean(payload.loyalty_enabled),
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
        action,
        entityType: "event_settings",
        entityId: "1",
        oldValue,
        newValue: data,
      });

      return Response.json({ success: true, data });
    }

    if (action === "UPDATE_GUEST_TIER") {
      const { data: oldValue } = await supabaseAdmin
        .from("event_guest_tiers")
        .select("*")
        .eq("id", payload.id)
        .single();

      const { data, error } = await supabaseAdmin
        .from("event_guest_tiers")
        .update({
          rate_per_guest_cents: Math.round(Number(payload.ratePerGuest) * 100),
          active: Boolean(payload.active),
        })
        .eq("id", payload.id)
        .select("*")
        .single();

      if (error) throw error;

      await logAdminAction({
        adminId: admin.username,
        action,
        entityType: "event_guest_tiers",
        entityId: payload.id,
        oldValue,
        newValue: data,
      });

      return Response.json({ success: true, data });
    }

    if (action === "UPSERT_ADD_ON") {
      let oldValue = null;

      if (payload.id) {
        const old = await supabaseAdmin
          .from("event_add_ons")
          .select("*")
          .eq("id", payload.id)
          .maybeSingle();

        oldValue = old.data;
      }

      const row = {
        code: String(payload.code || "")
          .trim()
          .toUpperCase()
          .replace(/\s+/g, "_"),
        group_name: payload.groupName,
        name: payload.name,
        description: payload.description || null,
        pricing_type: payload.pricingType,
        unit_price_cents: Math.round(Number(payload.unitPrice || 0) * 100),
        active: Boolean(payload.active),
        display_order: Number(payload.displayOrder || 100),
        updated_at: new Date().toISOString(),
      };

      const result = payload.id
        ? await supabaseAdmin
            .from("event_add_ons")
            .update(row)
            .eq("id", payload.id)
            .select("*")
            .single()
        : await supabaseAdmin
            .from("event_add_ons")
            .insert(row)
            .select("*")
            .single();

      if (result.error) throw result.error;

      await logAdminAction({
        adminId: admin.username,
        action,
        entityType: "event_add_ons",
        entityId: result.data.id,
        oldValue,
        newValue: result.data,
      });

      return Response.json({ success: true, data: result.data });
    }

    if (action === "UPDATE_SERVICE_AREA") {
      const { data: oldValue } = await supabaseAdmin
        .from("service_areas")
        .select("*")
        .eq("id", payload.id)
        .single();

      const { data, error } = await supabaseAdmin
        .from("service_areas")
        .update({
          active: Boolean(payload.active),
          minimum_guests: Number(payload.minimumGuests || 100),
          transport_fee_cents: Math.round(
            Number(payload.transportFee || 0) * 100
          ),
          center_lat: payload.centerLat === "" ? null : Number(payload.centerLat),
          center_lng: payload.centerLng === "" ? null : Number(payload.centerLng),
          radius_km: payload.radiusKm === "" ? null : Number(payload.radiusKm),
          notes: payload.notes || null,
        })
        .eq("id", payload.id)
        .select("*")
        .single();

      if (error) throw error;

      await supabaseAdmin
        .from("service_area_postal_codes")
        .delete()
        .eq("service_area_id", payload.id);

      const postalCodes = String(payload.postalCodes || "")
        .split(",")
        .map((value) => value.trim())
        .filter(Boolean);

      if (postalCodes.length) {
        const { error: postalError } = await supabaseAdmin
          .from("service_area_postal_codes")
          .insert(
            postalCodes.map((postalCode) => ({
              service_area_id: payload.id,
              postal_code: postalCode,
              active: true,
            }))
          );

        if (postalError) throw postalError;
      }

      await logAdminAction({
        adminId: admin.username,
        action,
        entityType: "service_areas",
        entityId: payload.id,
        oldValue,
        newValue: { ...data, postalCodes },
      });

      return Response.json({
        success: true,
        data: { ...data, postalCodes },
      });
    }

    if (action === "UPDATE_CART") {
      const { data: oldValue } = await supabaseAdmin
        .from("coffee_carts")
        .select("*")
        .eq("id", payload.id)
        .single();

      const { data, error } = await supabaseAdmin
        .from("coffee_carts")
        .update({
          active: Boolean(payload.active),
          status: payload.status,
          max_guests: Number(payload.maxGuests || 400),
          required_baristas: Number(payload.requiredBaristas || 2),
          setup_buffer_minutes: Number(payload.setupBufferMinutes || 90),
          travel_buffer_minutes: Number(payload.travelBufferMinutes || 60),
          notes: payload.notes || null,
        })
        .eq("id", payload.id)
        .select("*")
        .single();

      if (error) throw error;

      await logAdminAction({
        adminId: admin.username,
        action,
        entityType: "coffee_carts",
        entityId: payload.id,
        oldValue,
        newValue: data,
      });

      return Response.json({ success: true, data });
    }

    return Response.json(
      { success: false, error: "Acción no soportada." },
      { status: 400 }
    );
  } catch (error) {
    return fail(error);
  }
}
