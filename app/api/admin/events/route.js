import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { requireAdmin } from "@/lib/adminAuth";
import { logAdminAction } from "@/lib/adminAudit";

export const dynamic = "force-dynamic";

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

const OPERATIVE_STATUSES = [
  "CONFIRMED",
  "PREPARATION",
  "IN_SERVICE",
  "COMPLETED",
  "CANCELLED",
];

function fail(error) {
  const status = error.status || (error.message === "UNAUTHORIZED" ? 401 : 500);

  return Response.json(
    {
      success: false,
      error:
        error.message === "UNAUTHORIZED"
          ? "Unauthorized"
          : error.message || "Error inesperado.",
    },
    { status }
  );
}

function money(cents, legacy) {
  if (cents !== null && cents !== undefined) {
    return Number(cents) / 100;
  }

  return Number(legacy || 0);
}

async function timeline({
  bookingId,
  eventType,
  title,
  description = null,
  actor,
  metadata = {},
}) {
  const { error } = await supabaseAdmin.from("event_timeline").insert({
    booking_id: bookingId,
    event_type: eventType,
    title,
    description,
    actor,
    metadata,
  });

  if (error) throw error;
}

async function signedUploads(bookingId) {
  const { data, error } = await supabaseAdmin
    .from("event_uploads")
    .select("*")
    .eq("booking_id", bookingId)
    .order("created_at", { ascending: true });

  if (error) throw error;

  const uploads = [];

  for (const file of data || []) {
    const result = await supabaseAdmin.storage
      .from(file.bucket || "event-uploads")
      .createSignedUrl(file.storage_path, 3600);

    uploads.push({
      ...file,
      signedUrl: result.error ? null : result.data?.signedUrl || null,
    });
  }

  return uploads;
}

async function calendarData(from, to) {
  const [bookings, blocks, carts] = await Promise.all([
    supabaseAdmin
      .from("bookings")
      .select(
        "id,event_order_number,status,customer_name,event_type,city,state,venue_name,event_date,start_time,duration_hours,guests,total,total_cents,deposit,deposit_cents,balance,balance_cents,coffee_cart_id,shopify_order_id,created_at"
      )
      .gte("event_date", from)
      .lte("event_date", to)
      .not("event_order_number", "is", null)
      .order("event_date")
      .order("start_time"),

    supabaseAdmin
      .from("cart_availability")
      .select("*")
      .gte("event_date", from)
      .lte("event_date", to)
      .order("event_date"),

    supabaseAdmin
      .from("coffee_carts")
      .select("*")
      .order("code"),
  ]);

  const error = bookings.error || blocks.error || carts.error;
  if (error) throw error;

  const cartMap = new Map((carts.data || []).map((cart) => [cart.id, cart]));

  return {
    bookings: (bookings.data || []).map((booking) => ({
      ...booking,
      total: money(booking.total_cents, booking.total),
      deposit: money(booking.deposit_cents, booking.deposit),
      balance: money(booking.balance_cents, booking.balance),
      cart: booking.coffee_cart_id
        ? cartMap.get(booking.coffee_cart_id) || null
        : null,
    })),
    blocks: blocks.data || [],
    carts: carts.data || [],
  };
}

async function detailData(bookingId) {
  const { data: booking, error: bookingError } = await supabaseAdmin
    .from("bookings")
    .select("*")
    .eq("id", bookingId)
    .maybeSingle();

  if (bookingError) throw bookingError;

  if (!booking) {
    const error = new Error("Evento no encontrado.");
    error.status = 404;
    throw error;
  }

  const [items, staff, timelineResult, carts, assignments, uploads] =
    await Promise.all([
      supabaseAdmin
        .from("event_order_items")
        .select("*")
        .eq("booking_id", bookingId)
        .order("created_at"),

      supabaseAdmin
        .from("event_staff_assignments")
        .select("*")
        .eq("booking_id", bookingId)
        .order("created_at"),

      supabaseAdmin
        .from("event_timeline")
        .select("*")
        .eq("booking_id", bookingId)
        .order("created_at", { ascending: false }),

      supabaseAdmin
        .from("coffee_carts")
        .select("*")
        .eq("active", true)
        .order("code"),

      supabaseAdmin
        .from("event_cart_assignments")
        .select("*")
        .eq("booking_id", bookingId)
        .order("created_at"),

      signedUploads(bookingId),
    ]);

  const error =
    items.error ||
    staff.error ||
    timelineResult.error ||
    carts.error ||
    assignments.error;

  if (error) throw error;

  const snapshot = booking.pricing_snapshot || {};

  return {
    booking: {
      ...booking,
      total: money(booking.total_cents, booking.total),
      deposit: money(booking.deposit_cents, booking.deposit),
      balance: money(booking.balance_cents, booking.balance),
      subtotal:
        snapshot.subtotalCents !== undefined
          ? Number(snapshot.subtotalCents) / 100
          : null,
      vat:
        snapshot.vatCents !== undefined
          ? Number(snapshot.vatCents) / 100
          : null,
      vatPercent:
        snapshot.vatBps !== undefined ? Number(snapshot.vatBps) / 100 : null,
    },
    items: (items.data || []).map((item) => ({
      ...item,
      unitPrice: Number(item.unit_price_cents || 0) / 100,
      lineTotal: Number(item.line_total_cents || 0) / 100,
    })),
    staff: staff.data || [],
    timeline: timelineResult.data || [],
    uploads,
    availableCarts: carts.data || [],
    cartAssignments: assignments.data || [],
  };
}

async function ensureCartAvailable(booking, cartId) {
  const { data: cart, error: cartError } = await supabaseAdmin
    .from("coffee_carts")
    .select("*")
    .eq("id", cartId)
    .eq("active", true)
    .maybeSingle();

  if (cartError) throw cartError;

  if (!cart) {
    const error = new Error("El Coffee Cart seleccionado no está activo.");
    error.status = 400;
    throw error;
  }

  const { data: block, error: blockError } = await supabaseAdmin
    .from("cart_availability")
    .select("*")
    .eq("coffee_cart_id", cartId)
    .eq("event_date", booking.event_date)
    .maybeSingle();

  if (blockError) throw blockError;

  if (block) {
    const error = new Error(
      `Ese Coffee Cart está bloqueado para la fecha (${block.state}).`
    );
    error.status = 409;
    throw error;
  }

  const { data: conflicts, error: conflictError } = await supabaseAdmin
    .from("bookings")
    .select("id,event_order_number,status")
    .eq("coffee_cart_id", cartId)
    .eq("event_date", booking.event_date)
    .in("status", BLOCKING_STATUSES)
    .neq("id", booking.id);

  if (conflictError) throw conflictError;

  if (conflicts?.length) {
    const error = new Error(
      `Ese Coffee Cart ya tiene un evento activo el ${booking.event_date}.`
    );
    error.status = 409;
    throw error;
  }

  const { data: holdConflicts, error: holdError } = await supabaseAdmin
    .from("event_capacity_holds")
    .select("id,booking_id,status")
    .eq("coffee_cart_id", cartId)
    .eq("event_date", booking.event_date)
    .neq("booking_id", booking.id);

  if (holdError) throw holdError;

  if (holdConflicts?.length) {
    const error = new Error(
      "Ese Coffee Cart tiene una reserva de capacidad para esa fecha."
    );
    error.status = 409;
    throw error;
  }

  return cart;
}

export async function GET(request) {
  try {
    requireAdmin(request);

    const url = new URL(request.url);
    const view = url.searchParams.get("view") || "calendar";

    if (view === "detail") {
      const bookingId = url.searchParams.get("bookingId");

      if (!bookingId) {
        return Response.json(
          { success: false, error: "Falta bookingId." },
          { status: 400 }
        );
      }

      return Response.json({
        success: true,
        ...(await detailData(bookingId)),
      });
    }

    const from = url.searchParams.get("from");
    const to = url.searchParams.get("to");

    if (!from || !to) {
      return Response.json(
        {
          success: false,
          error: "Debes enviar from y to en formato YYYY-MM-DD.",
        },
        { status: 400 }
      );
    }

    return Response.json({
      success: true,
      ...(await calendarData(from, to)),
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

    if (action === "UPDATE_STATUS") {
      if (!OPERATIVE_STATUSES.includes(payload.status)) {
        return Response.json(
          { success: false, error: "Estado operativo no permitido." },
          { status: 400 }
        );
      }

      const { data: oldValue, error: readError } = await supabaseAdmin
        .from("bookings")
        .select("id,status")
        .eq("id", payload.bookingId)
        .single();

      if (readError) throw readError;

      const patch = {
        status: payload.status,
        operations_updated_at: new Date().toISOString(),
      };

      if (payload.status === "CANCELLED") {
        patch.cancelled_at = new Date().toISOString();
        patch.hold_expires_at = null;
      }

      const { data, error } = await supabaseAdmin
        .from("bookings")
        .update(patch)
        .eq("id", payload.bookingId)
        .select("*")
        .single();

      if (error) throw error;

      if (payload.status === "CANCELLED") {
        await supabaseAdmin
          .from("event_capacity_holds")
          .delete()
          .eq("booking_id", payload.bookingId);
      }

      await timeline({
        bookingId: payload.bookingId,
        eventType: "STATUS_CHANGED",
        title: `Estado cambiado a ${payload.status}`,
        actor: admin.username,
        metadata: {
          from: oldValue.status,
          to: payload.status,
        },
      });

      await logAdminAction({
        adminId: admin.username,
        action,
        entityType: "bookings",
        entityId: payload.bookingId,
        oldValue,
        newValue: { status: payload.status },
      });

      return Response.json({ success: true, booking: data });
    }

    if (action === "UPDATE_NOTES") {
      const { data: oldValue } = await supabaseAdmin
        .from("bookings")
        .select("operations_notes")
        .eq("id", payload.bookingId)
        .single();

      const { data, error } = await supabaseAdmin
        .from("bookings")
        .update({
          operations_notes: payload.notes || null,
          operations_updated_at: new Date().toISOString(),
        })
        .eq("id", payload.bookingId)
        .select("id,operations_notes,operations_updated_at")
        .single();

      if (error) throw error;

      await timeline({
        bookingId: payload.bookingId,
        eventType: "OPERATIONS_NOTES",
        title: "Notas operativas actualizadas",
        description: payload.notes || null,
        actor: admin.username,
      });

      await logAdminAction({
        adminId: admin.username,
        action,
        entityType: "bookings",
        entityId: payload.bookingId,
        oldValue,
        newValue: data,
      });

      return Response.json({ success: true, data });
    }

    if (action === "ASSIGN_CART") {
      const { data: booking, error: bookingError } = await supabaseAdmin
        .from("bookings")
        .select("*")
        .eq("id", payload.bookingId)
        .single();

      if (bookingError) throw bookingError;

      const cart = await ensureCartAvailable(booking, payload.coffeeCartId);

      const { data: ownHold, error: ownHoldError } = await supabaseAdmin
        .from("event_capacity_holds")
        .select("*")
        .eq("booking_id", booking.id)
        .maybeSingle();

      if (ownHoldError) throw ownHoldError;

      if (ownHold) {
        const { error: updateHoldError } = await supabaseAdmin
          .from("event_capacity_holds")
          .update({
            coffee_cart_id: cart.id,
            event_date: booking.event_date,
            status: "CONVERTED",
            expires_at: null,
          })
          .eq("id", ownHold.id);

        if (updateHoldError) throw updateHoldError;
      } else if (BLOCKING_STATUSES.includes(booking.status)) {
        const { error: insertHoldError } = await supabaseAdmin
          .from("event_capacity_holds")
          .insert({
            booking_id: booking.id,
            coffee_cart_id: cart.id,
            event_date: booking.event_date,
            status: "CONVERTED",
            expires_at: null,
          });

        if (insertHoldError) throw insertHoldError;
      }

      await supabaseAdmin
        .from("event_cart_assignments")
        .delete()
        .eq("booking_id", booking.id);

      const { error: assignmentError } = await supabaseAdmin
        .from("event_cart_assignments")
        .insert({
          booking_id: booking.id,
          coffee_cart_id: cart.id,
          assignment_type: "PRIMARY",
        });

      if (assignmentError) throw assignmentError;

      const { error: bookingUpdateError } = await supabaseAdmin
        .from("bookings")
        .update({
          coffee_cart_id: cart.id,
          operations_updated_at: new Date().toISOString(),
        })
        .eq("id", booking.id);

      if (bookingUpdateError) throw bookingUpdateError;

      await timeline({
        bookingId: booking.id,
        eventType: "CART_ASSIGNED",
        title: `Coffee Cart asignado: ${cart.code}`,
        description: cart.name,
        actor: admin.username,
        metadata: {
          coffee_cart_id: cart.id,
          code: cart.code,
        },
      });

      await logAdminAction({
        adminId: admin.username,
        action,
        entityType: "event_cart_assignments",
        entityId: booking.id,
        newValue: {
          coffee_cart_id: cart.id,
          code: cart.code,
        },
      });

      return Response.json({ success: true, cart });
    }

    if (action === "ADD_STAFF") {
      if (!payload.name?.trim() || !payload.role?.trim()) {
        return Response.json(
          { success: false, error: "Nombre y rol son obligatorios." },
          { status: 400 }
        );
      }

      const { data, error } = await supabaseAdmin
        .from("event_staff_assignments")
        .insert({
          booking_id: payload.bookingId,
          staff_name: payload.name.trim(),
          role: payload.role.trim(),
          notes: payload.notes?.trim() || null,
        })
        .select("*")
        .single();

      if (error) throw error;

      await timeline({
        bookingId: payload.bookingId,
        eventType: "STAFF_ASSIGNED",
        title: `${data.staff_name} asignado`,
        description: data.role,
        actor: admin.username,
      });

      await logAdminAction({
        adminId: admin.username,
        action,
        entityType: "event_staff_assignments",
        entityId: data.id,
        newValue: data,
      });

      return Response.json({ success: true, staff: data });
    }

    if (action === "REMOVE_STAFF") {
      const { data: oldValue, error: readError } = await supabaseAdmin
        .from("event_staff_assignments")
        .select("*")
        .eq("id", payload.staffId)
        .single();

      if (readError) throw readError;

      const { error } = await supabaseAdmin
        .from("event_staff_assignments")
        .delete()
        .eq("id", payload.staffId);

      if (error) throw error;

      await timeline({
        bookingId: oldValue.booking_id,
        eventType: "STAFF_REMOVED",
        title: `${oldValue.staff_name} removido`,
        description: oldValue.role,
        actor: admin.username,
      });

      await logAdminAction({
        adminId: admin.username,
        action,
        entityType: "event_staff_assignments",
        entityId: payload.staffId,
        oldValue,
        newValue: { deleted: true },
      });

      return Response.json({ success: true });
    }

    if (action === "BLOCK_CART_DATE") {
      const state =
        payload.state === "MAINTENANCE" ? "MAINTENANCE" : "ADMIN_BLOCKED";

      const { data: conflicts, error: conflictError } = await supabaseAdmin
        .from("bookings")
        .select("id,event_order_number,status")
        .eq("coffee_cart_id", payload.coffeeCartId)
        .eq("event_date", payload.eventDate)
        .in("status", BLOCKING_STATUSES);

      if (conflictError) throw conflictError;

      if (conflicts?.length) {
        return Response.json(
          {
            success: false,
            error:
              "No puedes bloquear ese Coffee Cart/día porque ya tiene un evento activo.",
          },
          { status: 409 }
        );
      }

      const { data, error } = await supabaseAdmin
        .from("cart_availability")
        .upsert(
          {
            coffee_cart_id: payload.coffeeCartId,
            event_date: payload.eventDate,
            state,
            reason: payload.reason?.trim() || null,
          },
          { onConflict: "coffee_cart_id,event_date" }
        )
        .select("*")
        .single();

      if (error) throw error;

      await logAdminAction({
        adminId: admin.username,
        action,
        entityType: "cart_availability",
        entityId: data.id,
        newValue: data,
      });

      return Response.json({ success: true, block: data });
    }

    if (action === "UNBLOCK_CART_DATE") {
      const { data: oldValue } = await supabaseAdmin
        .from("cart_availability")
        .select("*")
        .eq("id", payload.blockId)
        .maybeSingle();

      const { error } = await supabaseAdmin
        .from("cart_availability")
        .delete()
        .eq("id", payload.blockId);

      if (error) throw error;

      await logAdminAction({
        adminId: admin.username,
        action,
        entityType: "cart_availability",
        entityId: payload.blockId,
        oldValue,
        newValue: { deleted: true },
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
