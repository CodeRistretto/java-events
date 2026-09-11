import { supabaseAdmin } from "@/lib/supabaseAdmin";

export function bookingTotalCents(booking) {
  if (booking?.total_cents !== null && booking?.total_cents !== undefined) {
    return Number(booking.total_cents);
  }

  return Math.round(Number(booking?.total || 0) * 100);
}

export async function getEventPayments(bookingId) {
  const { data, error } = await supabaseAdmin
    .from("event_payments")
    .select("*")
    .eq("booking_id", bookingId)
    .order("created_at", { ascending: true });

  if (error) throw error;
  return data || [];
}

export function summarizeEventPayments(booking, payments = []) {
  const totalCents = bookingTotalCents(booking);
  let grossPaidCents = 0;
  let refundedCents = 0;

  for (const payment of payments) {
    if (payment.status !== "PAID") continue;

    const amount = Number(payment.amount_cents || 0);

    if (payment.payment_type === "REFUND") {
      refundedCents += amount;
    } else {
      grossPaidCents += amount;
    }
  }

  if (
    grossPaidCents === 0 &&
    booking?.shopify_order_id &&
    Number(booking?.deposit_cents || 0) > 0
  ) {
    grossPaidCents = Number(booking.deposit_cents);
  }

  const netPaidCents = Math.max(grossPaidCents - refundedCents, 0);
  const remainingCents = Math.max(totalCents - netPaidCents, 0);

  return {
    totalCents,
    grossPaidCents,
    refundedCents,
    paidCents: netPaidCents,
    remainingCents,
    fullyPaid: totalCents > 0 && remainingCents === 0,
    total: totalCents / 100,
    paid: netPaidCents / 100,
    refunded: refundedCents / 100,
    remaining: remainingCents / 100,
  };
}

export async function getEventFinancialSummary(booking) {
  const payments = await getEventPayments(booking.id);
  const summary = summarizeEventPayments(booking, payments);
  return { payments, summary };
}
