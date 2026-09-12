import { clearAdminCookie } from "@/lib/adminAuth";

export async function POST(request) {
  const response = Response.redirect(new URL("/admin", request.url), 303);
  response.headers.set("Set-Cookie", clearAdminCookie());
  return response;
}
