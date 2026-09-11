import crypto from "node:crypto";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

export async function POST(request) {
  try {
    const form = await request.formData();

    const bookingId = String(form.get("bookingId") || "");
    const uploadType = String(form.get("uploadType") || "ADDITIONAL_FILE");
    const file = form.get("file");

    if (!bookingId) {
      return Response.json(
        { success: false, error: "Falta bookingId." },
        { status: 400 }
      );
    }

    if (!file || typeof file.arrayBuffer !== "function") {
      return Response.json(
        { success: false, error: "Selecciona un archivo." },
        { status: 400 }
      );
    }

    const { data: booking, error: bookingError } = await supabaseAdmin
      .from("bookings")
      .select("id")
      .eq("id", bookingId)
      .maybeSingle();

    if (bookingError) throw bookingError;

    if (!booking) {
      return Response.json(
        { success: false, error: "Reservación no encontrada." },
        { status: 404 }
      );
    }

    const bytes = Buffer.from(await file.arrayBuffer());

    const safeName = String(file.name || "file")
      .replace(/[^\w.\-]+/g, "_")
      .slice(-120);

    const storagePath =
      `${bookingId}/${uploadType}/${crypto.randomUUID()}-${safeName}`;

    const { error: storageError } = await supabaseAdmin.storage
      .from("event-uploads")
      .upload(storagePath, bytes, {
        contentType: file.type || "application/octet-stream",
        upsert: false,
      });

    if (storageError) throw storageError;

    const { data: upload, error: insertError } = await supabaseAdmin
      .from("event_uploads")
      .insert({
        booking_id: bookingId,
        upload_type: uploadType,
        bucket: "event-uploads",
        storage_path: storagePath,
        original_name: file.name || null,
        mime_type: file.type || null,
      })
      .select("*")
      .single();

    if (insertError) throw insertError;

    return Response.json({ success: true, upload });
  } catch (error) {
    return Response.json(
      {
        success: false,
        error: error.message || "No fue posible subir el archivo.",
      },
      { status: 500 }
    );
  }
}
