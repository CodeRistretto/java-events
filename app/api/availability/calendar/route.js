import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { releaseExpiredInventory } from "@/lib/eventInventory";

const BLOCKING_STATUSES = [
  "HOLD",
  "PAYMENT_PENDING",
  "DEPOSIT_PAID",
  "PAID",
  "CONFIRMED",
  "PREPARATION",
  "IN_SERVICE",
  "COMPLETED",
];

function parseDateOnly(value) {
  const match = String(value || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  return Number.isNaN(date.getTime()) ? null : date;
}

function isoDate(date) {
  return date.toISOString().slice(0, 10);
}

function enumerateDates(from, to) {
  const dates = [];
  const cursor = new Date(from);
  while (cursor <= to) {
    dates.push(isoDate(cursor));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return dates;
}

function addToDateMap(map, date, cartId, extra = null) {
  if (!date || !cartId) return;
  if (!map.has(date)) map.set(date, []);
  map.get(date).push(extra ? { cartId, ...extra } : { cartId });
}

export async function GET(request) {
  try {
    const url = new URL(request.url);
    const serviceAreaId = url.searchParams.get("serviceAreaId");
    const fromValue = url.searchParams.get("from");
    const toValue = url.searchParams.get("to");

    if (!serviceAreaId) {
      return Response.json({ success: false, error: "Selecciona una ciudad." }, { status: 400 });
    }

    const from = parseDateOnly(fromValue);
    const to = parseDateOnly(toValue);
    if (!from || !to || to < from) {
      return Response.json({ success: false, error: "Rango de calendario inválido." }, { status: 400 });
    }

    const rangeDays = Math.floor((to.getTime() - from.getTime()) / 86400000) + 1;
    if (rangeDays > 62) {
      return Response.json({ success: false, error: "El rango máximo es de 62 días." }, { status: 400 });
    }

    await releaseExpiredInventory();

    const { data: assignments, error: assignmentError } = await supabaseAdmin
      .from("coffee_cart_service_areas")
      .select("coffee_cart_id")
      .eq("service_area_id", serviceAreaId)
      .eq("active", true);

    if (assignmentError) throw assignmentError;

    const assignedCartIds = [...new Set((assignments || []).map((row) => row.coffee_cart_id).filter(Boolean))];
    const dates = enumerateDates(from, to);

    if (!assignedCartIds.length) {
      return Response.json({
        success: true,
        from: fromValue,
        to: toValue,
        dates: dates.map((date) => ({ date, available: false, availableCount: 0, state: "SOLD_OUT" })),
      });
    }

    const { data: carts, error: cartsError } = await supabaseAdmin
      .from("coffee_carts")
      .select("id")
      .in("id", assignedCartIds)
      .eq("active", true)
      .eq("status", "AVAILABLE");

    if (cartsError) throw cartsError;

    const cartIds = (carts || []).map((cart) => cart.id);
    if (!cartIds.length) {
      return Response.json({
        success: true,
        from: fromValue,
        to: toValue,
        dates: dates.map((date) => ({ date, available: false, availableCount: 0, state: "SOLD_OUT" })),
      });
    }

    const now = new Date().toISOString();

    const [blocksResult, holdsResult, bookingsResult] = await Promise.all([
      supabaseAdmin
        .from("cart_availability")
        .select("coffee_cart_id,event_date,state")
        .in("coffee_cart_id", cartIds)
        .gte("event_date", fromValue)
        .lte("event_date", toValue),
      supabaseAdmin
        .from("event_capacity_holds")
        .select("coffee_cart_id,event_date,status,expires_at")
        .in("coffee_cart_id", cartIds)
        .eq("status", "ACTIVE")
        .gt("expires_at", now)
        .gte("event_date", fromValue)
        .lte("event_date", toValue),
      supabaseAdmin
        .from("bookings")
        .select("coffee_cart_id,event_date,status")
        .in("coffee_cart_id", cartIds)
        .in("status", BLOCKING_STATUSES)
        .gte("event_date", fromValue)
        .lte("event_date", toValue),
    ]);

    if (blocksResult.error) throw blocksResult.error;
    if (holdsResult.error) throw holdsResult.error;
    if (bookingsResult.error) throw bookingsResult.error;

    const blocksByDate = new Map();
    const holdsByDate = new Map();
    const bookingsByDate = new Map();

    for (const row of blocksResult.data || []) {
      addToDateMap(blocksByDate, row.event_date, row.coffee_cart_id, { state: row.state });
    }
    for (const row of holdsResult.data || []) {
      addToDateMap(holdsByDate, row.event_date, row.coffee_cart_id);
    }
    for (const row of bookingsResult.data || []) {
      addToDateMap(bookingsByDate, row.event_date, row.coffee_cart_id);
    }

    const result = dates.map((date) => {
      const blockedRows = blocksByDate.get(date) || [];
      const holdRows = holdsByDate.get(date) || [];
      const bookingRows = bookingsByDate.get(date) || [];

      const unavailableCartIds = new Set([
        ...blockedRows.map((row) => row.cartId),
        ...holdRows.map((row) => row.cartId),
        ...bookingRows.map((row) => row.cartId),
      ]);

      const availableCount = Math.max(0, cartIds.length - unavailableCartIds.size);
      if (availableCount > 0) {
        return { date, available: true, availableCount, state: "AVAILABLE" };
      }

      let state = "SOLD_OUT";
      if (holdRows.length) state = "TEMPORARILY_HELD";
      else if (blockedRows.length === cartIds.length && blockedRows.some((row) => row.state === "MAINTENANCE")) {
        state = "MAINTENANCE";
      } else if (blockedRows.length === cartIds.length) {
        state = "ADMIN_BLOCKED";
      }

      return { date, available: false, availableCount: 0, state };
    });

    return Response.json({ success: true, from: fromValue, to: toValue, dates: result });
  } catch (error) {
    return Response.json(
      { success: false, error: error.message || "No fue posible cargar la disponibilidad del calendario." },
      { status: 500 }
    );
  }
}
