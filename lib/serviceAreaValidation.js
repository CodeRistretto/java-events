import { supabaseAdmin } from "@/lib/supabaseAdmin";

function haversineKm(lat1, lon1, lat2, lon2) {
  const toRad = (n) => (n * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) ** 2;

  return 2 * R * Math.asin(Math.sqrt(a));
}

export async function validateServiceAreaAddress({
  serviceAreaId,
  postalCode,
  latitude,
  longitude,
}) {
  const { data: area, error } = await supabaseAdmin
    .from("service_areas")
    .select("*")
    .eq("id", serviceAreaId)
    .eq("active", true)
    .maybeSingle();

  if (error) throw error;
  if (!area) throw new Error("La zona de servicio no está activa.");

  const { data: postalRows, error: postalError } = await supabaseAdmin
    .from("service_area_postal_codes")
    .select("postal_code")
    .eq("service_area_id", serviceAreaId)
    .eq("active", true);

  if (postalError) throw postalError;

  if (postalRows?.length) {
    const allowed = new Set(postalRows.map((row) => String(row.postal_code).trim()));

    if (!postalCode || !allowed.has(String(postalCode).trim())) {
      throw new Error("Esta dirección está fuera de nuestra zona actual de Java Coffee Cart.");
    }
  }

  if (
    area.center_lat !== null &&
    area.center_lng !== null &&
    area.radius_km !== null &&
    latitude !== null &&
    latitude !== undefined &&
    longitude !== null &&
    longitude !== undefined
  ) {
    const distance = haversineKm(
      Number(area.center_lat),
      Number(area.center_lng),
      Number(latitude),
      Number(longitude)
    );

    if (distance > Number(area.radius_km)) {
      throw new Error("Esta dirección está fuera de nuestra zona actual de Java Coffee Cart.");
    }
  }

  return area;
}
