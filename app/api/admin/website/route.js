import crypto from "node:crypto";
import { requireAdmin } from "@/lib/adminAuth";
import { logAdminAction } from "@/lib/adminAudit";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

const BUCKET = "event-site-assets";
const SLOTS = {
  hero: { column: "hero_image_url", folder: "hero" },
  service: { column: "service_image_url", folder: "service" },
  favicon: { column: "favicon_url", folder: "favicon" },
};

function fail(error) {
  const status = error.status || (error.message === "UNAUTHORIZED" ? 401 : 500);
  return Response.json({ success: false, error: error.message === "UNAUTHORIZED" ? "Unauthorized" : error.message }, { status });
}

function fileExt(file) {
  const map = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "image/gif": "gif",
    "image/x-icon": "ico",
    "image/vnd.microsoft.icon": "ico",
  };
  return map[file.type] || "png";
}

export async function GET(request) {
  try {
    requireAdmin(request);
    const { data, error } = await supabaseAdmin
      .from("event_settings")
      .select("hero_image_url,service_image_url,favicon_url,updated_at")
      .eq("id", 1)
      .single();
    if (error) throw error;
    return Response.json({ success: true, settings: data });
  } catch (error) {
    return fail(error);
  }
}

export async function POST(request) {
  try {
    const admin = requireAdmin(request);
    const form = await request.formData();
    const slot = String(form.get("slot") || "");
    const file = form.get("file");
    const config = SLOTS[slot];

    if (!config) return Response.json({ success: false, error: "Tipo de imagen inválido." }, { status: 400 });
    if (!file || typeof file.arrayBuffer !== "function") return Response.json({ success: false, error: "Selecciona una imagen." }, { status: 400 });
    if (!String(file.type || "").startsWith("image/")) return Response.json({ success: false, error: "El archivo debe ser una imagen." }, { status: 400 });
    if (Number(file.size || 0) > 8 * 1024 * 1024) return Response.json({ success: false, error: "La imagen debe pesar menos de 8 MB." }, { status: 400 });

    const path = `${config.folder}/${Date.now()}-${crypto.randomUUID()}.${fileExt(file)}`;
    const bytes = Buffer.from(await file.arrayBuffer());
    const { error: uploadError } = await supabaseAdmin.storage.from(BUCKET).upload(path, bytes, {
      contentType: file.type || undefined,
      cacheControl: "31536000",
      upsert: false,
    });
    if (uploadError) throw uploadError;

    const { data: publicData } = supabaseAdmin.storage.from(BUCKET).getPublicUrl(path);
    const publicUrl = publicData?.publicUrl;
    if (!publicUrl) throw new Error("No fue posible obtener la URL de la imagen.");

    const { data: oldValue } = await supabaseAdmin
      .from("event_settings")
      .select("hero_image_url,service_image_url,favicon_url")
      .eq("id", 1)
      .single();

    const { data, error } = await supabaseAdmin
      .from("event_settings")
      .update({ [config.column]: publicUrl, updated_at: new Date().toISOString() })
      .eq("id", 1)
      .select("hero_image_url,service_image_url,favicon_url,updated_at")
      .single();
    if (error) throw error;

    await logAdminAction({
      adminId: admin.username,
      action: "UPDATE_WEBSITE_IMAGE",
      entityType: "event_settings",
      entityId: "1",
      oldValue,
      newValue: { slot, url: publicUrl },
    });

    return Response.json({ success: true, settings: data, slot, url: publicUrl });
  } catch (error) {
    return fail(error);
  }
}
