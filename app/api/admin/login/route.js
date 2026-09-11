import { createAdminCookie, clearAdminCookie } from "@/lib/adminAuth";

export async function POST(request) {
  try {
    const body = await request.json();

    const expectedUser = process.env.ADMIN_USERNAME;
    const expectedPassword = process.env.ADMIN_PASSWORD;

    if (!expectedUser || !expectedPassword) {
      throw new Error("Faltan ADMIN_USERNAME o ADMIN_PASSWORD.");
    }

    if (body.username !== expectedUser || body.password !== expectedPassword) {
      return Response.json(
        { success: false, error: "Credenciales inválidas." },
        { status: 401 }
      );
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Set-Cookie": createAdminCookie(body.username),
      },
    });
  } catch (error) {
    return Response.json(
      {
        success: false,
        error: error.message || "No fue posible iniciar sesión.",
      },
      { status: 500 }
    );
  }
}

export async function DELETE() {
  return new Response(JSON.stringify({ success: true }), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Set-Cookie": clearAdminCookie(),
    },
  });
}
