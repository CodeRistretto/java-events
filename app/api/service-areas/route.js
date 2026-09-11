import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function GET() {
  try {
    const { data, error } = await supabaseAdmin
      .from("service_areas")
      .select("id, city, state")
      .eq("active", true)
      .order("city");

    if (error) {
      throw error;
    }

    return Response.json({
      success: true,
      serviceAreas: data,
    });
  } catch (error) {
    return Response.json(
      {
        success: false,
        error: error.message,
      },
      { status: 500 }
    );
  }
}