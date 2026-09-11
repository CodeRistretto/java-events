import { supabaseAdmin } from "@/lib/supabaseAdmin";

const BLOCKING_STATUSES = [
  "HOLD",
  "PAYMENT_PENDING",
  "DEPOSIT_PAID",
  "PAID",
  "CONFIRMED",
  "PREPARATION",
  "COMPLETED",
];

export async function releaseExpiredInventory() {
  const now = new Date().toISOString();

  await supabaseAdmin
    .from("bookings")
    .update({ status: "EXPIRED" })
    .in("status", ["HOLD", "PAYMENT_PENDING"])
    .lt("hold_expires_at", now);

  await supabaseAdmin
    .from("event_capacity_holds")
    .delete()
    .eq("status", "ACTIVE")
    .lt("expires_at", now);
}

export async function getCandidateCarts(serviceAreaId, eventDate) {
  await releaseExpiredInventory();

  const { data: assignments, error: assignmentError } = await supabaseAdmin
    .from("coffee_cart_service_areas")
    .select("coffee_cart_id")
    .eq("service_area_id", serviceAreaId)
    .eq("active", true);

  if (assignmentError) throw assignmentError;

  const cartIds = (assignments || []).map((row) => row.coffee_cart_id);
  if (!cartIds.length) return [];

  const { data: carts, error: cartsError } = await supabaseAdmin
    .from("coffee_carts")
    .select("*")
    .in("id", cartIds)
    .eq("active", true)
    .eq("status", "AVAILABLE");

  if (cartsError) throw cartsError;
  if (!carts?.length) return [];

  const { data: blocks, error: blocksError } = await supabaseAdmin
    .from("cart_availability")
    .select("coffee_cart_id,state")
    .eq("event_date", eventDate)
    .in("coffee_cart_id", carts.map((cart) => cart.id));

  if (blocksError) throw blocksError;

  const blockedCartIds = new Set((blocks || []).map((row) => row.coffee_cart_id));

  const { data: holds, error: holdsError } = await supabaseAdmin
    .from("event_capacity_holds")
    .select("coffee_cart_id,status,expires_at")
    .eq("event_date", eventDate)
    .in("coffee_cart_id", carts.map((cart) => cart.id));

  if (holdsError) throw holdsError;

  const heldCartIds = new Set((holds || []).map((row) => row.coffee_cart_id));

  const { data: bookings, error: bookingsError } = await supabaseAdmin
    .from("bookings")
    .select("coffee_cart_id,status")
    .eq("event_date", eventDate)
    .in("status", BLOCKING_STATUSES)
    .in("coffee_cart_id", carts.map((cart) => cart.id));

  if (bookingsError) throw bookingsError;

  const bookedCartIds = new Set((bookings || []).map((row) => row.coffee_cart_id));

  return carts.filter(
    (cart) =>
      !blockedCartIds.has(cart.id) &&
      !heldCartIds.has(cart.id) &&
      !bookedCartIds.has(cart.id)
  );
}

export async function getDateAvailability(serviceAreaId, eventDate) {
  await releaseExpiredInventory();

  const { data: assignments } = await supabaseAdmin
    .from("coffee_cart_service_areas")
    .select("coffee_cart_id")
    .eq("service_area_id", serviceAreaId)
    .eq("active", true);

  const allCartIds = (assignments || []).map((row) => row.coffee_cart_id);

  if (!allCartIds.length) {
    return { available: false, availableCount: 0, state: "SOLD_OUT" };
  }

  const availableCarts = await getCandidateCarts(serviceAreaId, eventDate);

  if (availableCarts.length) {
    return {
      available: true,
      availableCount: availableCarts.length,
      state: "AVAILABLE",
      carts: availableCarts,
    };
  }

  const now = new Date().toISOString();

  const { data: activeHolds } = await supabaseAdmin
    .from("event_capacity_holds")
    .select("coffee_cart_id")
    .eq("event_date", eventDate)
    .eq("status", "ACTIVE")
    .gt("expires_at", now)
    .in("coffee_cart_id", allCartIds);

  if (activeHolds?.length) {
    return {
      available: false,
      availableCount: 0,
      state: "TEMPORARILY_HELD",
    };
  }

  const { data: blocks } = await supabaseAdmin
    .from("cart_availability")
    .select("state")
    .eq("event_date", eventDate)
    .in("coffee_cart_id", allCartIds);

  if (blocks?.length === allCartIds.length && blocks.some((b) => b.state === "MAINTENANCE")) {
    return { available: false, availableCount: 0, state: "MAINTENANCE" };
  }

  if (blocks?.length === allCartIds.length) {
    return { available: false, availableCount: 0, state: "ADMIN_BLOCKED" };
  }

  return { available: false, availableCount: 0, state: "SOLD_OUT" };
}
