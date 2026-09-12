import { supabaseAdmin } from "@/lib/supabaseAdmin";

export function centsToMoney(cents) {
  return Number(cents || 0) / 100;
}

export async function getEventSettings() {
  const { data, error } = await supabaseAdmin
    .from("event_settings")
    .select("*")
    .eq("id", 1)
    .single();

  if (error) throw error;
  return data;
}

async function getGuestTier(guestCount) {
  const { data, error } = await supabaseAdmin
    .from("event_guest_tiers")
    .select("*")
    .eq("guest_count", guestCount)
    .eq("active", true)
    .is("effective_to", null)
    .maybeSingle();

  if (error) throw error;
  if (!data) {
    throw new Error(
      "El número de invitados seleccionado no tiene una tarifa activa."
    );
  }
  return data;
}

async function getServiceArea(serviceAreaId) {
  const { data, error } = await supabaseAdmin
    .from("service_areas")
    .select("*")
    .eq("id", serviceAreaId)
    .eq("active", true)
    .maybeSingle();

  if (error) throw error;
  if (!data) throw new Error("La zona de servicio no está disponible.");
  return data;
}

async function getAddOns(codes) {
  if (!codes?.length) return [];

  const { data, error } = await supabaseAdmin
    .from("event_add_ons")
    .select("*")
    .in("code", codes)
    .eq("active", true)
    .is("effective_to", null);

  if (error) throw error;
  return data || [];
}

function normalizedDuration(value, fallback) {
  const duration = Number(value);
  if (!Number.isFinite(duration) || duration <= 0) return Number(fallback || 2);
  return duration;
}

function splitVatInclusiveAmount(grossCents, vatBps) {
  const gross = Math.max(0, Math.round(Number(grossCents || 0)));
  const rateBps = Math.max(0, Number(vatBps || 0));

  if (!rateBps) {
    return { grossCents: gross, netCents: gross, vatCents: 0 };
  }

  const netCents = Math.round((gross * 10000) / (10000 + rateBps));

  return {
    grossCents: gross,
    netCents,
    vatCents: gross - netCents,
  };
}

export async function calculateEventQuote({
  serviceAreaId,
  guestCount,
  selectedAddOns = [],
  paymentChoice = null,
  durationHours = null,
}) {
  const settings = await getEventSettings();
  const guests = Number(guestCount);

  if (
    !Number.isInteger(guests) ||
    guests < settings.minimum_guests ||
    guests > settings.maximum_guests ||
    (guests - settings.minimum_guests) % settings.guest_increment !== 0
  ) {
    throw new Error(
      `Selecciona un número de invitados válido entre ${settings.minimum_guests} y ${settings.maximum_guests}.`
    );
  }

  const includedHours = Number(settings.standard_duration_hours || 2);
  const serviceDurationHours = normalizedDuration(durationHours, includedHours);

  // Every started hour beyond the included duration is billed as one extra hour.
  // Example: 2.5 h => 1 extra hour, 3 h => 1 extra hour, 3.5 h => 2 extra hours.
  const additionalHours = Math.max(
    0,
    Math.ceil(serviceDurationHours - includedHours - 0.000001)
  );

  const [tier, serviceArea] = await Promise.all([
    getGuestTier(guests),
    getServiceArea(serviceAreaId),
  ]);

  // ADDITIONAL_HOUR is authoritative from the selected schedule. Ignore any
  // client-provided quantity for this code so it cannot be removed, reduced,
  // duplicated, or manipulated from the browser.
  const normalizedSelectedAddOns = (selectedAddOns || []).filter(
    (item) => item?.code && item.code !== "ADDITIONAL_HOUR"
  );

  if (additionalHours > 0) {
    normalizedSelectedAddOns.push({
      code: "ADDITIONAL_HOUR",
      quantity: additionalHours,
    });
  }

  const codes = [...new Set(normalizedSelectedAddOns.map((item) => item.code))];
  const addOns = await getAddOns(codes);
  const addOnMap = new Map(addOns.map((item) => [item.code, item]));

  if (additionalHours > 0 && !addOnMap.has("ADDITIONAL_HOUR")) {
    throw new Error(
      "El evento supera las horas incluidas, pero no hay una tarifa activa para horas adicionales. Contacta a Java antes de continuar."
    );
  }

  const items = [];
  const baseSubtotalCents = guests * Number(tier.rate_per_guest_cents);

  items.push({
    itemType: "BASE",
    code: "HOT_COFFEE_SERVICE",
    name: "Hot Coffee Service",
    pricingType: "PER_GUEST",
    quantity: guests,
    unitPriceCents: Number(tier.rate_per_guest_cents),
    lineTotalCents: baseSubtotalCents,
  });

  let addOnsTotalCents = 0;

  for (const selected of normalizedSelectedAddOns) {
    const addOn = addOnMap.get(selected.code);
    if (!addOn) continue;

    let quantity = 1;

    if (addOn.pricing_type === "PER_GUEST") quantity = guests;
    if (addOn.pricing_type === "PER_HOUR") {
      quantity = Math.max(1, Number(selected.quantity || 1));
    }
    if (addOn.pricing_type === "PER_UNIT") {
      quantity = Math.max(1, Number(selected.quantity || 1));
    }

    const lineTotalCents = Math.round(quantity * Number(addOn.unit_price_cents));
    addOnsTotalCents += lineTotalCents;

    items.push({
      itemType: "ADD_ON",
      code: addOn.code,
      name: addOn.name,
      pricingType: addOn.pricing_type,
      quantity,
      unitPriceCents: Number(addOn.unit_price_cents),
      lineTotalCents,
    });
  }

  // Service-area transport prices are configured as final customer-facing
  // amounts. Split the included VAT here so the configured amount is never
  // taxed a second time.
  const transport = splitVatInclusiveAmount(
    serviceArea.transport_fee_cents,
    settings.vat_bps
  );
  const transportFeeCents = transport.grossCents;

  if (transportFeeCents > 0) {
    items.push({
      itemType: "TRANSPORT",
      code: "SERVICE_AREA_TRANSPORT",
      name: "Transportation",
      pricingType: "PER_EVENT",
      quantity: 1,
      unitPriceCents: transport.netCents,
      lineTotalCents: transport.netCents,
      vatInclusiveLineTotalCents: transportFeeCents,
    });
  }

  const taxableServicesCents = baseSubtotalCents + addOnsTotalCents;
  const servicesVatCents = Math.round(
    (taxableServicesCents * Number(settings.vat_bps)) / 10000
  );
  const subtotalCents = taxableServicesCents + transport.netCents;
  const vatCents = servicesVatCents + transport.vatCents;
  const totalCents = subtotalCents + vatCents;

  let paymentMode = settings.payment_mode;

  if (
    settings.payment_mode === "CHOICE" &&
    ["FULL", "DEPOSIT"].includes(paymentChoice)
  ) {
    paymentMode = paymentChoice;
  }

  const depositCents =
    paymentMode === "FULL"
      ? totalCents
      : Math.round((totalCents * Number(settings.deposit_bps)) / 10000);

  const balanceCents = Math.max(0, totalCents - depositCents);

  return {
    currency: "MXN",
    guestCount: guests,
    durationHours: serviceDurationHours,
    includedHours,
    additionalHours,
    ratePerGuestCents: Number(tier.rate_per_guest_cents),
    baseSubtotalCents,
    addOnsTotalCents,
    transportFeeCents,
    transportNetCents: transport.netCents,
    transportVatCents: transport.vatCents,
    subtotalCents,
    vatBps: Number(settings.vat_bps),
    vatCents,
    totalCents,
    paymentMode,
    depositBps: Number(settings.deposit_bps),
    depositCents,
    balanceCents,
    items,
    serviceArea: {
      id: serviceArea.id,
      city: serviceArea.city,
      state: serviceArea.state,
    },
    snapshotVersion: 2,
    calculatedAt: new Date().toISOString(),
  };
}
