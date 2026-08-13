/* =============================================================================
   Admin session
   =============================================================================
   Supabase Auth email/password, with the access token in an httpOnly cookie
   scoped to /admin. Two consequences worth being explicit about:

   · httpOnly means no script on the site can read the token, including any
     third-party tag we add later. The admin reads leads — full names, phone
     numbers, budgets — so a token readable from JavaScript is not acceptable.
   · path=/admin means the browser does not attach it to requests for public
     pages, which keeps it out of the CDN's hands on every cached route.

   Authentication is not authorisation. A valid Supabase Auth token proves
   someone is *a* user of this project; it says nothing about whether they may
   read leads. So every session is resolved through `brokers` — a token with no
   active broker row behind it is signed in and permitted nothing.

   Two roles (0009_crm_access.sql):

     admin  — every lead, and the only role that can reassign one or create
              another login.
     broker — only leads assigned to them.

   There is still no signup path. Brokers are created from /admin/brokers by an
   admin, which makes the auth user and the broker row in one step.
   ============================================================================= */

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "./supabase";

const COOKIE = "prg-admin-token";
const MAX_AGE = 60 * 60 * 8; // one working day

function authClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    { auth: { persistSession: false } },
  );
}

export type AdminRole = "admin" | "broker";

/** The signed-in person, resolved all the way to their broker row. `brokerId`
 *  is what scopes every query — never the email, which is only ever a label. */
export type AdminUser = {
  email: string;
  brokerId: string;
  name: string;
  role: AdminRole;
};

export async function signIn(
  email: string,
  password: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { data, error } = await authClient().auth.signInWithPassword({ email, password });
  if (error || !data.session) {
    // Deliberately does not distinguish "no such user" from "wrong password" —
    // the difference is only useful to someone enumerating accounts.
    return { ok: false, error: "Those credentials didn't work." };
  }

  // Correct password, no access. Checked here as well as in getAdminUser so the
  // failure is legible: without it the cookie is set, /admin bounces straight
  // back to the login form, and the screen reads as if the password were wrong.
  // Same wording for "no row" and "deactivated" — which of the two it is tells
  // an outsider something about the account, and tells a real broker nothing
  // they can act on without calling Charles anyway.
  const { data: broker } = await supabaseAdmin()
    .from("brokers")
    .select("is_active")
    .eq("auth_user_id", data.user.id)
    .maybeSingle();

  if (!broker || !(broker as { is_active: boolean }).is_active) {
    return { ok: false, error: "That account does not have access to the CRM." };
  }

  const jar = await cookies();
  jar.set(COOKIE, data.session.access_token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/admin",
    maxAge: MAX_AGE,
  });
  return { ok: true };
}

export async function signOut(): Promise<void> {
  (await cookies()).delete({ name: COOKIE, path: "/admin" });
}

/** The session check every admin page runs. Two hops, both required:
 *
 *  1. Validate the token against Supabase rather than trusting the cookie's
 *     existence, so a revoked or expired session stops working immediately.
 *  2. Resolve it to an active broker row. A user who authenticates but has no
 *     row — or whose row was deactivated — gets null and is treated exactly
 *     like a stranger, without waiting for the token to expire.
 */
export async function getAdminUser(): Promise<AdminUser | null> {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;

  const { data, error } = await authClient().auth.getUser(token);
  if (error || !data.user?.email) return null;

  const { data: broker, error: brokerError } = await supabaseAdmin()
    .from("brokers")
    .select("id, name, role, is_active")
    .eq("auth_user_id", data.user.id)
    .maybeSingle();

  if (brokerError || !broker) return null;

  const row = broker as { id: string; name: string; role: string; is_active: boolean };
  if (!row.is_active) return null;
  // An unrecognised role is not a reason to fall back to the permissive one.
  if (row.role !== "admin" && row.role !== "broker") return null;

  return {
    email: data.user.email,
    brokerId: row.id,
    name: row.name,
    role: row.role,
  };
}

/** Use at the top of every admin page and server action. Returns the user or
 *  redirects — so a caller that forgets to check cannot silently proceed.
 *
 *  Render-time gating is not a security boundary: a Server Action is a POST
 *  endpoint reachable without going through the UI, so this runs inside the
 *  action too, never only in the component that renders its form. */
export async function requireAdmin(): Promise<AdminUser> {
  const user = await getAdminUser();
  if (!user) redirect("/admin/login");
  return user;
}

/** For the things only an admin may do: reassign a lead, create a login, see
 *  someone else's pipeline. Redirects rather than throwing, so a broker who
 *  follows a stale link lands somewhere useful instead of on an error. */
export async function requireRole(role: AdminRole): Promise<AdminUser> {
  const user = await requireAdmin();
  if (user.role !== role) redirect("/admin");
  return user;
}
