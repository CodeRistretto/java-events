import { runEventPaymentReminders } from "@/lib/eventPaymentReminders";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request) {
  const key = process.env.EVENTS_AUTOMATION_KEY;
  if (!key || request.headers.get("authorization") !== `Bearer ${key}`) {
    return Response.json({ success: false }, { status: 401 });
  }

  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Monterrey",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());

  try {
    const report = await runEventPaymentReminders(today);
    return Response.json({ success: true, today, ...report });
  } catch (error) {
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
}
