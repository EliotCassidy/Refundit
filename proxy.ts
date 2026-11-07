// Next 16 "proxy" (formerly middleware): refreshes the Supabase session and
// redirects signed-out users to /login. API routes are excluded: they check
// auth themselves (webhooks use signatures, not cookies).
import type { NextRequest } from "next/server";
import { updateSession } from "@/lib/shared/supabase/proxy";

export async function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: ["/((?!api/|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
