import { createClient } from "@supabase/supabase-js";

/**
 * Server-side only. Uses the service-role key, which bypasses RLS — never
 * import this from a client component, and never expose
 * SUPABASE_SERVICE_ROLE_KEY to the browser. See docs/phase-1-prd.md §9.
 */
export function getServiceClient() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not set");
  }
  return createClient(url, key, { auth: { persistSession: false } });
}
