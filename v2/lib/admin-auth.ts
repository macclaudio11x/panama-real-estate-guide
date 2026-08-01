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

   There is no admin *role* here. Anyone with a Supabase Auth user on this
   project can sign in, so accounts are created by hand in the dashboard and
   there is no signup path. That is the whole access model, and it is only
   adequate while the user list is two or three people.
   ============================================================================= */

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@supabase/supabase-js";

const COOKIE = "prg-admin-token";
const MAX_AGE = 60 * 60 * 8; // one working day

function authClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    { auth: { persistSession: false } },
  );
}

export type AdminUser = { email: string };

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

/** The session check every admin page runs. Validates the token against
 *  Supabase rather than trusting the cookie's existence, so a revoked or
 *  expired session stops working immediately. */
export async function getAdminUser(): Promise<AdminUser | null> {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  const { data, error } = await authClient().auth.getUser(token);
  if (error || !data.user?.email) return null;
  return { email: data.user.email };
}

/** Use at the top of every admin page and server action. Returns the user or
 *  redirects — so a caller that forgets to check cannot silently proceed. */
export async function requireAdmin(): Promise<AdminUser> {
  const user = await getAdminUser();
  if (!user) redirect("/admin/login");
  return user;
}
