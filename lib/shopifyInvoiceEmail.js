import { shopifyGraphQL } from "@/lib/shopify";

export async function sendDraftOrderInvoiceEmail({ draftOrderId, to, subject, customMessage }) {
  const data = await shopifyGraphQL(
    `mutation SendJavaDraftInvoice($id: ID!, $email: EmailInput) {
      draftOrderInvoiceSend(id: $id, email: $email) {
        draftOrder { id invoiceUrl invoiceSentAt }
        userErrors { field message }
      }
    }`,
    { id: draftOrderId, email: { to, subject, customMessage } }
  );

  const errors = data?.draftOrderInvoiceSend?.userErrors || [];
  if (errors.length) throw new Error(errors.map((item) => item.message).join(" | "));

  const draft = data?.draftOrderInvoiceSend?.draftOrder;
  if (!draft?.id) throw new Error("Shopify no confirmó el envío de la factura.");
  return draft;
}
