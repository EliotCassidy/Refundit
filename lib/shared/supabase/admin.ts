// Service-role Supabase client. BYPASSES RLS. Server only: route handlers,
// webhooks, seed script. Never import from a client component.
import "server-only";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "../database.types";

let admin: ReturnType<typeof createClient<Database>> | undefined;

export function createAdminClient() {
  admin ??= createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
  return admin;
}
