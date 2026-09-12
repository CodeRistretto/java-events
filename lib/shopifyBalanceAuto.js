import { getEventFinancialSummary } from "@/lib/eventPayments";
import { normalizeMexicoPhone } from "@/lib/phone";
import { shopifyGraphQL } from "@/lib/shopify";
import { ensureShopifyCustomer } from "@/lib/shopifyCustomer";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { balanceDraftInput, calculateBalanceDraft, closeEnough } from "@/lib/shopifyBalanceTax";

export async function ensureAutomatedBalanceDraft(booking) {
  const { summary } = await getEventFinancialSummary(booking);
  if (summary.remainingCents <= 0) return { alreadyPaid: true, summary };

  if (booking.shopify_balance_draft_order_id) {
    const existing = await shopifyGraphQL(
      `query ExistingBalance($id: ID!) {
        draftOrder(id: $id) { id invoiceUrl status order { id } }
      }`,
      { id: booking.shopify_balance_draft_order_id }
    );
    const draft = existing?.draftOrder;
    if (draft?.invoiceUrl && !draft?.order?.id) {
      return {
        alreadyPaid: false,
        reused: true,
        draftOrderId: draft.id,
        invoiceUrl: draft.invoiceUrl,
        amountCents: summary.remainingCents,
        summary,
      };
    }
  }

  const phone = normalizeMexicoPhone(booking.phone);
  if (!phone) throw new Error("El teléfono del cliente no es válido.");
  const customer = await ensureShopifyCustomer({
    email: booking.email,
    phone,
    customerName: booking.customer_name,
  });

  const rate = Number(booking.pricing_snapshot?.vatBps ?? 1600) / 10000;
  const netCents = rate ? Math.round(summary.remainingCents / (1 + rate)) : summary.remainingCents;
  const vatCents = summary.remainingCents - netCents;
  let selectedInput = null;

  for (const lineCents of rate ? [summary.remainingCents, netCents] : [summary.remainingCents]) {
    const input = balanceDraftInput({
      booking,
      customerId: customer.id,
      phone,
      paymentId: "AUTO_BALANCE",
      amountCents: summary.remainingCents,
      lineCents,
      vatCents,
    });
    input.customAttributes = input.customAttributes.filter((item) => item.key !== "java_payment_id");
    const calculated = await calculateBalanceDraft(input);
    if (closeEnough(calculated.totalCents, summary.remainingCents) && closeEnough(calculated.taxCents, vatCents)) {
      selectedInput = input;
      break;
    }
  }

  if (!selectedInput) throw new Error("Shopify no está calculando correctamente el IVA del saldo.");

  const created = await shopifyGraphQL(
    `mutation CreateAutoBalance($input: DraftOrderInput!) {
      draftOrderCreate(input: $input) {
        draftOrder { id name invoiceUrl }
        userErrors { message }
      }
    }`,
    { input: selectedInput }
  );

  const errors = created?.draftOrderCreate?.userErrors || [];
  if (errors.length) throw new Error(errors.map((item) => item.message).join(" | "));
  const draft = created?.draftOrderCreate?.draftOrder;
  if (!draft?.id || !draft?.invoiceUrl) throw new Error("Shopify no devolvió un checkout para el saldo.");

  const { error: updateError } = await supabaseAdmin
    .from("bookings")
    .update({ shopify_customer_id: customer.id, shopify_balance_draft_order_id: draft.id })
    .eq("id", booking.id);
  if (updateError) throw updateError;

  await supabaseAdmin.from("event_timeline").insert({
    booking_id: booking.id,
    event_type: "BALANCE_CHECKOUT_CREATED",
    title: `Checkout automático de saldo creado`,
    description: draft.name || null,
    actor: "automation",
    metadata: { draft_order_id: draft.id, amount_cents: summary.remainingCents },
  });

  return {
    alreadyPaid: false,
    reused: false,
    draftOrderId: draft.id,
    invoiceUrl: draft.invoiceUrl,
    amountCents: summary.remainingCents,
    summary,
  };
}
