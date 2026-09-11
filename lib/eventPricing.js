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
  if (!data) throw new Error("El número de invitados seleccionado no tiene una tarifa activa.");
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

export async function calculateEventQuote({
  serviceAreaId,
  guestCount,
  selectedAddOns = [],
  paymentChoice = null,
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

  const [tier, serviceArea] = await Promise.all([
    getGuestTier(guests),
    getServiceArea(serviceAreaId),
  ]);

  const codes = selectedAddOns.map((item) => item.code).filter(Boolean);
  const addOns = await getAddOns(codes);
  const addOnMap = new Map(addOns.map((item) => [item.code, item]));

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

  for (const selected of selectedAddOns) {
    const addOn = addOnMap.get(selected.code);
    if (!addOn) continue;

    let quantity = 1;

    if (addOn.pricing_type === "PER_GUEST") quantity = guests;
    if (addOn.pricing_type === "PER_HOUR") quantity = Math.max(1, Number(selected.quantity || 1));
    if (addOn.pricing_type === "PER_UNIT") quantity = Math.max(1, Number(selected.quantity || 1));

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

  const transportFeeCents = Number(serviceArea.transport_fee_cents || 0);

  if (transportFeeCents > 0) {
    items.push({
      itemType: "TRANSPORT",
      code: "SERVICE_AREA_TRANSPORT",
      name: "Transportation",
      pricingType: "PER_EVENT",
      quantity: 1,
      unitPriceCents: transportFeeCents,
      lineTotalCents: transportFeeCents,
    });
  }

  const subtotalCents = baseSubtotalCents + addOnsTotalCents + transportFeeCents;
  const vatCents = Math.round(subtotalCents * Number(settings.vat_bps) / 10000);
  const totalCents = subtotalCents + vatCents;

  let paymentMode = settings.payment_mode;

  if (settings.payment_mode === "CHOICE" && ["FULL", "DEPOSIT"].includes(paymentChoice)) {
    paymentMode = paymentChoice;
  }

  const depositCents =
    paymentMode === "FULL"
      ? totalCents
      : Math.round(totalCents * Number(settings.deposit_bps) / 10000);

  const balanceCents = Math.max(0, totalCents - depositCents);

  return {
    currency: "MXN",
    guestCount: guests,
    ratePerGuestCents: Number(tier.rate_per_guest_cents),
    baseSubtotalCents,
    addOnsTotalCents,
    transportFeeCents,
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
    snapshotVersion: 1,
    calculatedAt: new Date().toISOString(),
  };
}
