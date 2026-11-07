// OWNER: Dev 2. NotCoca admin login: sets the hashed-key cookie.
import { ADMIN_COOKIE, checkKey, hashKey } from "@/lib/notcoca/admin";

export async function POST(request: Request) {
  const form = await request.formData();
  const key = String(form.get("key") ?? "");
  const back = new URL("/notcoca/admin", request.url);
  if (!checkKey(key)) {
    back.searchParams.set("error", "1");
    return Response.redirect(back, 303);
  }
  const res = Response.redirect(back, 303);
  const headers = new Headers(res.headers);
  headers.append(
    "Set-Cookie",
    `${ADMIN_COOKIE}=${hashKey(key)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=86400${process.env.NODE_ENV === "production" ? "; Secure" : ""}`,
  );
  return new Response(null, { status: 303, headers });
}
