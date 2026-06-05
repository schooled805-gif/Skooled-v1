import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Vercel's Supabase integration provides SUPABASE_URL (no VITE_ prefix); local
// Replit dev uses VITE_SUPABASE_URL. Accept either so the API server works in both.
const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Whether auth is actually configured. Exposed so middleware can return a clean
// 503 (instead of a cryptic error) when a token needs verifying but the
// credentials are missing.
export const supabaseConfigured = !!(supabaseUrl && serviceRoleKey);

// Never throw at module load: on a serverless host (Vercel) an import-time throw
// crashes the ENTIRE function (FUNCTION_INVOCATION_FAILED), which takes down the
// public routes and the frontend too. Log instead and let authenticated routes
// fail cleanly per-request when the client is actually used.
if (!supabaseConfigured) {
  console.error(
    "[supabase] SUPABASE_URL (or VITE_SUPABASE_URL) and SUPABASE_SERVICE_ROLE_KEY " +
      "are not set. Authenticated routes will fail until they are configured.",
  );
}

export const supabaseAdmin: SupabaseClient = createClient(
  supabaseUrl ?? "http://supabase-not-configured.invalid",
  serviceRoleKey ?? "not-configured",
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  },
);
