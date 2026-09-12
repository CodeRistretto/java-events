import { shopifyGraphQL } from "@/lib/shopify";

export const centsMoney = (cents) => (Number(cents || 0) / 100).toFixed(2);
export const closeEnough = (a, b) => Math.abs(Number(a) - Number(b)) <= 2;

export function balanceDraftInput({ booking, customerId, phone, paymentId, amountCents, lineCents, vatCents }) {
  const base = process.env.APP_BASE_URL || "http://localhost:3000";
  const confirmationUrl = `${base}/confirmation/${booking.id}`;
  const input = {
    purchasingEntity: { customerId },
    email: booking.email,
    phone,
    presentmentCurrencyCode: "MXN",
    taxExempt: false,
    visibleToCustomer: true,
    tags: ["JAVA_EVENT", "JAVA_COFFEE_CART", "EVENT_BALANCE"],
    note: `Saldo Java Coffee Cart · ${booking.event_order_number || booking.id}\nSaldo: $${centsMoney(amountCents)} MXN\nConfirmación: ${confirmationUrl}`,
    customAttributes: [
      { key: "java_booking_id", value: String(booking.id) },
      { key: "java_payment_id", value: String(paymentId) },
      { key: "payment_type", value: "BALANCE" },
      { key: "event_order_number", value: String(booking.event_order_number || "") },
      { key: "event_date", value: String(booking.event_date || "") },
      { key: "amount_to_pay", value: centsMoney(amountCents) },
      { key: "confirmation_url", value: confirmationUrl },
    ],
    lineItems: [{
      title: `Saldo Java Coffee Cart · ${booking.event_order_number || "Evento"}`,
      quantity: 1,
      originalUnitPriceWithCurrency: { amount: centsMoney(lineCents), currencyCode: "MXN" },
      requiresShipping: false,
      taxable: true,
      customAttributes: [
        { key: "Qué estás pagando", value: "Saldo pendiente del evento Java Coffee Cart" },
        { key: "IVA esperado", value: centsMoney(vatCents) },
        { key: "Booking ID", value: String(booking.id) },
      ],
    }],
  };

  if (booking.event_address && booking.city) {
    const names = String(booking.customer_name || "Cliente").trim().split(/\s+/);
    input.shippingAddress = {
      firstName: names[0] || "Cliente",
      lastName: names.slice(1).join(" ") || "Java Events",
      address1: booking.event_address,
      city: booking.city,
      zip: booking.postal_code || undefined,
      countryCode: "MX",
      phone,
    };
  }

  return input;
}

export async function calculateBalanceDraft(input) {
  const data = await shopifyGraphQL(
    `mutation Calc($input: DraftOrderInput!) {
      draftOrderCalculate(input: $input) {
        calculatedDraftOrder {
          totalTaxSet { presentmentMoney { amount } }
          totalPriceSet { presentmentMoney { amount } }
        }
        userErrors { message }
      }
    }`,
    { input }
  );

  const errors = data?.draftOrderCalculate?.userErrors || [];
  if (errors.length) throw new Error(errors.map((item) => item.message).join(" | "));
  const draft = data?.draftOrderCalculate?.calculatedDraftOrder;
  return {
    taxCents: Math.round(Number(draft?.totalTaxSet?.presentmentMoney?.amount || 0) * 100),
    totalCents: Math.round(Number(draft?.totalPriceSet?.presentmentMoney?.amount || 0) * 100),
  };
}
