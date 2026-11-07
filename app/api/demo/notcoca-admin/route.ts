// OWNER: Dev 2. GET /api/demo/notcoca-admin — jury demo: opens the NotCoca back-office already signed in.
// Only for the demo account (sets the same hashed-key cookie as /api/notcoca/admin/login).
import { isDemoEmail } from "@/lib/demo/config";
import { ADMIN_COOKIE, hashKey } from "@/lib/notcoca/admin";
import { getUser } from "@/lib/shared/supabase/server";

export async function GET(request: Request) {
  const user = await getUser();
  const key = process.env.NOTCOCA_ADMIN_KEY;
  if (!user || !isDemoEmail(user.email) || !key) return Response.redirect(new URL("/notcoca/admin", request.url), 303);
  const headers = new Headers({ Location: new URL("/notcoca/admin", request.url).toString() });
  headers.append(
    "Set-Cookie",
    `${ADMIN_COOKIE}=${hashKey(key)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=86400${process.env.NODE_ENV === "production" ? "; Secure" : ""}`,
  );
  return new Response(null, { status: 303, headers });
}
