export async function POST() {
  return Response.json(
    { success: false, error: "Route not in use." },
    { status: 404 }
  );
}
