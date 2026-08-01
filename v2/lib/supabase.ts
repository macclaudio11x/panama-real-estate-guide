import { createClient } from "@supabase/supabase-js";

/* =============================================================================
   Supabase client
   =============================================================================
   Uses the publishable key, which is meant to be public — it ships in client
   bundles by design. Security comes from RLS, not from hiding this value, so
   every table must have its policies right before it holds anything real.

   The service-role key must never appear in this file, in NEXT_PUBLIC_* vars,
   or anywhere that reaches the browser. When the lead endpoint needs elevated
   writes it reads a server-only var inside a route handler.
   ============================================================================= */

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

if (!url || !key) {
  throw new Error(
    "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY. " +
      "Copy them into v2/.env.local — see supabase/migrations/0001_init.sql.",
  );
}

export const supabase = createClient(url, key, {
  auth: { persistSession: false },
});

/* -----------------------------------------------------------------------------
   Service-role client
   -----------------------------------------------------------------------------
   Bypasses RLS entirely, which is the only way to touch `leads`, `lead_events`,
   `brokers`, and `subscribers` — those four have RLS enabled with no policy, so
   every other role reads nothing from them.

   Call this inside a route handler or a server component, never at module
   scope. Importing this file from a client component is safe (the constant
   above is public); *calling* this function from one is not, and the missing
   env var throwing here is what makes that mistake loud instead of silent.
   -------------------------------------------------------------------------- */

export function supabaseAdmin() {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) {
    throw new Error(
      "Missing SUPABASE_SERVICE_ROLE_KEY. It is server-only — add it to " +
        "v2/.env.local and to the Netlify environment, never to a NEXT_PUBLIC_ var.",
    );
  }
  return createClient(url!, serviceKey, { auth: { persistSession: false } });
}
