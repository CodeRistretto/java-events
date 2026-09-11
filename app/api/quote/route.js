import { calculateEventQuote, centsToMoney } from "@/lib/eventPricing";

export async function POST(request) {
  try {
    const body = await request.json();

    const quote = await calculateEventQuote({
      serviceAreaId: body.serviceAreaId,
      guestCount: Number(body.guestCount ?? body.guests),
      selectedAddOns: Array.isArray(body.selectedAddOns) ? body.selectedAddOns : [],
      paymentChoice: body.paymentChoice || null,
    });

    return Response.json({
      success: true,
      quote: {
        ...quote,
        ratePerGuest: centsToMoney(quote.ratePerGuestCents),
        baseSubtotal: centsToMoney(quote.baseSubtotalCents),
        addOnsTotal: centsToMoney(quote.addOnsTotalCents),
        transportFee: centsToMoney(quote.transportFeeCents),
        subtotal: centsToMoney(quote.subtotalCents),
        vat: centsToMoney(quote.vatCents),
        total: centsToMoney(quote.totalCents),
        deposit: centsToMoney(quote.depositCents),
        balance: centsToMoney(quote.balanceCents),
        items: quote.items.map((item) => ({
          ...item,
          unitPrice: centsToMoney(item.unitPriceCents),
          lineTotal: centsToMoney(item.lineTotalCents),
        })),
      },
      serviceArea: quote.serviceArea,
    });
  } catch (error) {
    return Response.json(
      {
        success: false,
        error: error.message || "No fue posible calcular la cotización.",
      },
      { status: 400 }
    );
  }
}
