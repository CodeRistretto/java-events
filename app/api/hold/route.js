import crypto from "node:crypto";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import {
  calculateEventQuote,
  centsToMoney,
  getEventSettings,
} from "@/lib/eventPricing";
import {
  getCandidateCarts,
  releaseExpiredInventory,
} from "@/lib/eventInventory";
import { validateServiceAreaAddress } from "@/lib/serviceAreaValidation";
import { normalizeMexicoPhone } from "@/lib/phone";

function validEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
    String(value || "").trim()
  );
}

function createOrderNumber() {
  const ymd = new Date().toISOString().slice(0, 10).replaceAll("-", "");
  return `JEV-${ymd}-${crypto.randomBytes(3).toString("hex").toUpperCase()}`;
}

export async function POST(request) {
  try {
    const body = await request.json();

    const customerName = String(body.customerName || "").trim();
    const email = String(body.email || "").trim().toLowerCase();
    const phone = normalizeMexicoPhone(body.phone);

    if (!customerName) throw new Error("Escribe el nombre completo.");
    if (!validEmail(email)) throw new Error("Ingresa un correo electrónico válido.");
    if (!phone) throw new Error("Ingresa un teléfono mexicano válido de 10 dígitos.");
    if (!body.eventDate) throw new Error("Selecciona la fecha del evento.");
    if (!body.startTime) throw new Error("Selecciona la hora de inicio.");
    if (!body.endTime) throw new Error("Selecciona la hora de término.");
    if (!body.serviceAreaId) throw new Error("Selecciona una ciudad.");
    if (!body.venueName) throw new Error("Ingresa el nombre del lugar.");
    if (!body.eventAddress) throw new Error("Ingresa la calle y número.");
    if (!body.neighborhood) throw new Error("Ingresa la colonia.");
    if (!body.postalCode) throw new Error("Ingresa el código postal.");
    if (!body.indoorOutdoor) throw new Error("Indica si el evento es interior o exterior.");
    if (!body.floor) throw new Error("Indica el piso.");
    if (body.elevator === undefined || body.elevator === null) {
      throw new Error("Indica si hay elevador.");
    }
    if (!body.unloadingAccess) throw new Error("Describe el acceso de descarga.");
    if (!body.setupAccessTime) throw new Error("Indica la hora de acceso para montaje.");
    if (!body.electricityDetails) throw new Error("Describe la disponibilidad eléctrica.");
    if (body.potableWater === undefined || body.potableWater === null) {
      throw new Error("Indica si hay agua potable.");
    }
    if (
      body.waterDistanceM === "" ||
      body.waterDistanceM === undefined ||
      body.waterDistanceM === null
    ) {
      throw new Error("Indica la distancia aproximada al agua.");
    }
    if (!body.termsAccepted) {
      throw new Error("Debes aceptar las condiciones del servicio.");
    }

    if (body.invoiceRequired && (!body.taxName || !body.taxRfc)) {
      throw new Error("Completa los datos fiscales para facturación.");
    }

    await validateServiceAreaAddress({
      serviceAreaId: body.serviceAreaId,
      postalCode: body.postalCode,
      latitude: body.latitude ?? null,
      longitude: body.longitude ?? null,
    });

    const quote = await calculateEventQuote({
      serviceAreaId: body.serviceAreaId,
      guestCount: Number(body.guestCount ?? body.guests),
      selectedAddOns: Array.isArray(body.selectedAddOns)
        ? body.selectedAddOns
        : [],
      paymentChoice: body.paymentChoice || null,
    });

    const settings = await getEventSettings();

    await releaseExpiredInventory();

    const candidates = await getCandidateCarts(
      body.serviceAreaId,
      body.eventDate
    );

    if (!candidates.length) {
      return Response.json(
        {
          success: false,
          error:
            "Esta fecha ya no está disponible para eventos de Java Coffee Cart. Selecciona otro día.",
        },
        { status: 409 }
      );
    }

    const holdExpiresAt = new Date(
      Date.now() + Number(settings.hold_minutes) * 60 * 1000
    ).toISOString();

    for (const cart of candidates) {
      const eventOrderNumber = createOrderNumber();

      const { data: booking, error: bookingError } = await supabaseAdmin
        .from("bookings")
        .insert({
          customer_name: customerName,
          email,
          phone,
          event_type: body.eventType || null,
          city: quote.serviceArea.city,
          state: quote.serviceArea.state,
          event_address: body.eventAddress,
          venue_name: body.venueName,
          neighborhood: body.neighborhood,
          postal_code: body.postalCode,
          latitude: body.latitude ?? null,
          longitude: body.longitude ?? null,
          event_date: body.eventDate,
          start_time: body.startTime,
          duration_hours: Math.max(
            1,
            Number(body.durationHours || settings.standard_duration_hours)
          ),
          guests: quote.guestCount,
          package_name: "Java Coffee Cart",
          matcha_bar: false,
          extra_barista: false,
          total: centsToMoney(quote.totalCents),
          deposit: centsToMoney(quote.depositCents),
          balance: centsToMoney(quote.balanceCents),
          total_cents: quote.totalCents,
          deposit_cents: quote.depositCents,
          balance_cents: quote.balanceCents,
          status: "HOLD",
          hold_expires_at: holdExpiresAt,
          coffee_cart_id: cart.id,
          notes: body.notes || null,
          event_order_number: eventOrderNumber,
          indoor_outdoor: body.indoorOutdoor,
          floor: body.floor,
          elevator: Boolean(body.elevator),
          unloading_access: body.unloadingAccess,
          setup_access_time: body.setupAccessTime,
          electricity_details: body.electricityDetails,
          potable_water: Boolean(body.potableWater),
          water_distance_m: Number(body.waterDistanceM),
          invoice_required: Boolean(body.invoiceRequired),
          tax_name: body.invoiceRequired ? body.taxName : null,
          tax_rfc: body.invoiceRequired ? body.taxRfc : null,
          tax_usage: body.invoiceRequired ? body.taxUsage || null : null,
          terms_accepted_at: new Date().toISOString(),
          selected_add_ons: body.selectedAddOns || [],
          pricing_snapshot: quote,
          payment_method: body.paymentMethod || null,
        })
        .select("*")
        .single();

      if (bookingError) throw bookingError;

      const { error: capacityError } = await supabaseAdmin
        .from("event_capacity_holds")
        .insert({
          booking_id: booking.id,
          coffee_cart_id: cart.id,
          event_date: body.eventDate,
          status: "ACTIVE",
          expires_at: holdExpiresAt,
        });

      if (capacityError) {
        await supabaseAdmin.from("bookings").delete().eq("id", booking.id);

        if (capacityError.code === "23505") {
          continue;
        }

        throw capacityError;
      }

      const itemRows = quote.items.map((item) => ({
        booking_id: booking.id,
        item_type: item.itemType,
        item_code: item.code,
        item_name: item.name,
        pricing_type: item.pricingType,
        quantity: item.quantity,
        unit_price_cents: item.unitPriceCents,
        line_total_cents: item.lineTotalCents,
        snapshot: item,
      }));

      if (itemRows.length) {
        const { error: itemError } = await supabaseAdmin
          .from("event_order_items")
          .insert(itemRows);

        if (itemError) throw itemError;
      }

      await supabaseAdmin.from("event_cart_assignments").insert({
        booking_id: booking.id,
        coffee_cart_id: cart.id,
        assignment_type: "PRIMARY",
      });

      return Response.json({
        success: true,
        bookingId: booking.id,
        eventOrderNumber,
        holdExpiresAt,
        hold: {
          bookingId: booking.id,
          expiresAt: holdExpiresAt,
          holdExpiresAt,
          minutes: Number(settings.hold_minutes),
        },
        serviceArea: quote.serviceArea,
        quote: {
          total: centsToMoney(quote.totalCents),
          deposit: centsToMoney(quote.depositCents),
          balance: centsToMoney(quote.balanceCents),
          totalCents: quote.totalCents,
          depositCents: quote.depositCents,
          balanceCents: quote.balanceCents,
        },
        cart: {
          id: cart.id,
          code: cart.code,
          name: cart.name,
        },
      });
    }

    return Response.json(
      {
        success: false,
        error:
          "Otro cliente tomó la última disponibilidad. Selecciona otra fecha.",
      },
      { status: 409 }
    );
  } catch (error) {
    console.error("Hold API error:", error);

    return Response.json(
      {
        success: false,
        error: error.message || "No fue posible apartar el evento.",
      },
      { status: 400 }
    );
  }
}
