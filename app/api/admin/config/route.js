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

function numberField(value, label, { min = -Infinity, max = Infinity, blank = false } = {}) {
  if (blank && (value === "" || value === null || value === undefined)) return null;

  const number = Number(value);
  if (!Number.isFinite(number) || number < min || number > max) {
    const error = new Error(`${label} no es válido.`);
    error.status = 400;
    throw error;
  }
  return number;
}

function normalizedPostalCodes(value) {
  const codes = [...new Set(
    String(value || "")
      .split(",")
      .map((postalCode) => postalCode.trim())
      .filter(Boolean)
  )];

  const invalid = codes.find((postalCode) => !/^\d{5}$/.test(postalCode));
  if (invalid) {
    const error = new Error(`El código postal ${invalid} debe tener 5 dígitos.`);
    error.status = 400;
    throw error;
  }

  return codes;
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

    if (action === "CREATE_SERVICE_AREA") {
      const city = String(payload.city || "").trim();
      const state = String(payload.state || "").trim();

      if (!city || !state) {
        const error = new Error("Ciudad y estado son obligatorios.");
        error.status = 400;
        throw error;
      }

      const minimumGuests = numberField(payload.minimumGuests, "El mínimo de invitados", {
        min: 1,
        max: 10000,
      });
      const transportFee = numberField(payload.transportFee, "El cargo de transporte", {
        min: 0,
        max: 1000000,
      });
      const centerLat = numberField(payload.centerLat, "La latitud", {
        min: -90,
        max: 90,
        blank: true,
      });
      const centerLng = numberField(payload.centerLng, "La longitud", {
        min: -180,
        max: 180,
        blank: true,
      });
      const radiusKm = numberField(payload.radiusKm, "El radio", {
        min: 0.1,
        max: 1000,
        blank: true,
      });
      const postalCodes = normalizedPostalCodes(payload.postalCodes);
      const requestedCartIds = [...new Set(
        (Array.isArray(payload.cartIds) ? payload.cartIds : [])
          .map((value) => String(value || "").trim())
          .filter(Boolean)
      )];

      if ((centerLat === null) !== (centerLng === null)) {
        const error = new Error("Captura juntas la latitud y la longitud.");
        error.status = 400;
        throw error;
      }

      if (!requestedCartIds.length) {
        const error = new Error("Selecciona al menos un Coffee Cart.");
        error.status = 400;
        throw error;
      }

      const duplicate = await supabaseAdmin
        .from("service_areas")
        .select("id")
        .ilike("city", city)
        .ilike("state", state)
        .limit(1)
        .maybeSingle();

      if (duplicate.error) throw duplicate.error;
      if (duplicate.data) {
        const error = new Error(`${city}, ${state} ya existe como área de servicio.`);
        error.status = 409;
        throw error;
      }

      const carts = await supabaseAdmin
        .from("coffee_carts")
        .select("id,code,name")
        .in("id", requestedCartIds)
        .eq("active", true);

      if (carts.error) throw carts.error;
      if ((carts.data || []).length !== requestedCartIds.length) {
        const error = new Error("Uno de los Coffee Carts seleccionados ya no está activo.");
        error.status = 400;
        throw error;
      }

      const created = await supabaseAdmin
        .from("service_areas")
        .insert({
          city,
          state,
          active: false,
          minimum_guests: Math.round(minimumGuests),
          transport_fee_cents: Math.round(transportFee * 100),
          center_lat: centerLat,
          center_lng: centerLng,
          radius_km: radiusKm,
          notes: String(payload.notes || "").trim() || null,
          activation_at: null,
        })
        .select("*")
        .single();

      if (created.error) throw created.error;

      try {
        if (postalCodes.length) {
          const postalResult = await supabaseAdmin
            .from("service_area_postal_codes")
            .insert(
              postalCodes.map((postalCode) => ({
                service_area_id: created.data.id,
                postal_code: postalCode,
                active: true,
              }))
            );
          if (postalResult.error) throw postalResult.error;
        }

        const coverage = await supabaseAdmin
          .from("coffee_cart_service_areas")
          .insert(
            requestedCartIds.map((cartId) => ({
              coffee_cart_id: cartId,
              service_area_id: created.data.id,
              active: true,
            }))
          );
        if (coverage.error) throw coverage.error;

        const activated = await supabaseAdmin
          .from("service_areas")
          .update({
            active: Boolean(payload.active),
            activation_at: payload.active ? new Date().toISOString() : null,
          })
          .eq("id", created.data.id)
          .select("*")
          .single();
        if (activated.error) throw activated.error;

        const newValue = {
          ...activated.data,
          postalCodes,
          cartIds: requestedCartIds,
        };

        await logAdminAction({
          adminId: admin.username,
          action,
          entityType: "service_areas",
          entityId: created.data.id,
          oldValue: null,
          newValue,
        });

        return Response.json({ success: true, data: newValue });
      } catch (error) {
        await supabaseAdmin.from("service_areas").delete().eq("id", created.data.id);
        throw error;
      }
    }

    if (action === "UPDATE_SERVICE_AREA") {
      if (!payload.id) {
        const error = new Error("Falta el identificador del área de servicio.");
        error.status = 400;
        throw error;
      }

      const minimumGuests = numberField(payload.minimumGuests, "El mínimo de invitados", {
        min: 1,
        max: 10000,
      });
      const transportFee = numberField(payload.transportFee, "El cargo de transporte", {
        min: 0,
        max: 1000000,
      });
      const centerLat = numberField(payload.centerLat, "La latitud", {
        min: -90,
        max: 90,
        blank: true,
      });
      const centerLng = numberField(payload.centerLng, "La longitud", {
        min: -180,
        max: 180,
        blank: true,
      });
      const radiusKm = numberField(payload.radiusKm, "El radio", {
        min: 0.1,
        max: 1000,
        blank: true,
      });
      const postalCodes = normalizedPostalCodes(payload.postalCodes);

      if ((centerLat === null) !== (centerLng === null)) {
        const error = new Error("Captura juntas la latitud y la longitud.");
        error.status = 400;
        throw error;
      }

      const { data: oldValue } = await supabaseAdmin
        .from("service_areas")
        .select("*")
        .eq("id", payload.id)
        .single();

      const { data, error } = await supabaseAdmin
        .from("service_areas")
        .update({
          active: Boolean(payload.active),
          minimum_guests: Math.round(minimumGuests),
          transport_fee_cents: Math.round(transportFee * 100),
          center_lat: centerLat,
          center_lng: centerLng,
          radius_km: radiusKm,
          notes: String(payload.notes || "").trim() || null,
        })
        .eq("id", payload.id)
        .select("*")
        .single();

      if (error) throw error;

      await supabaseAdmin
        .from("service_area_postal_codes")
        .delete()
        .eq("service_area_id", payload.id);

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
