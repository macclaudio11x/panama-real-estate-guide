"use server";

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/admin-auth";
import { supabaseAdmin } from "@/lib/supabase";

/* Creating a login is the one place the admin touches Supabase Auth. It is
   deliberately not a self-signup: there is no public route that reaches any of
   this, and `requireRole('admin')` runs inside every action rather than only on
   the page that renders the form. */

export type BrokerFormState = {
  ok: boolean;
  message: string | null;
  /** Shown once, never stored. See the note in `createBroker`. */
  tempPassword?: string;
};

export const BROKER_IDLE: BrokerFormState = { ok: true, message: null };

function slugify(name: string): string {
  return (
    name
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || "broker"
  );
}

/** A password nobody has to invent, strong enough that a weak one cannot be
 *  chosen by habit. Shown to the admin once so they can pass it on, and never
 *  written anywhere else — there is no column for it and no email sent, which
 *  is also why it cannot be recovered afterwards, only reset. */
function tempPassword(): string {
  return randomBytes(12).toString("base64url");
}

export async function createBroker(
  _prev: BrokerFormState,
  formData: FormData,
): Promise<BrokerFormState> {
  await requireRole("admin");
  const sb = supabaseAdmin();

  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const firm = String(formData.get("firm") ?? "").trim() || null;
  const phone = String(formData.get("phone") ?? "").trim() || null;
  const roleRaw = String(formData.get("role") ?? "broker");
  const role = roleRaw === "admin" ? "admin" : "broker";
  const wantsLogin = formData.get("with_login") === "on";

  if (!name) return { ok: false, message: "A name is required." };
  if (wantsLogin && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return { ok: false, message: "A valid email is required to create a login." };
  }

  // Slug is unique in the schema, so a second "Maria Gonzalez" needs a suffix
  // rather than a failed insert.
  const base = slugify(name);
  const { data: taken } = await sb.from("brokers").select("slug").like("slug", `${base}%`);
  const existing = new Set((taken ?? []).map((r) => (r as { slug: string }).slug));
  let slug = base;
  for (let n = 2; existing.has(slug); n++) slug = `${base}-${n}`;

  let authUserId: string | null = null;
  let password: string | undefined;

  if (wantsLogin) {
    password = tempPassword();
    const { data, error } = await sb.auth.admin.createUser({
      email,
      password,
      // No confirmation mail: this project has no transactional sender wired to
      // Auth, and an unconfirmed user cannot sign in with a password.
      email_confirm: true,
    });

    if (error || !data.user) {
      return {
        ok: false,
        message:
          error?.message?.includes("already been registered") ||
          error?.message?.includes("already exists")
            ? "That email already has a login on this project."
            : (error?.message ?? "Could not create the login."),
      };
    }
    authUserId = data.user.id;
  }

  const { error } = await sb.from("brokers").insert({
    slug,
    name,
    email: email || null,
    firm,
    phone,
    role,
    is_active: true,
    auth_user_id: authUserId,
  });

  if (error) {
    // The auth user was created a moment ago and now has no broker row, so it
    // would authenticate and resolve to nothing. Roll it back rather than leave
    // an orphan that blocks the email from being used again.
    if (authUserId) await sb.auth.admin.deleteUser(authUserId);
    return { ok: false, message: error.message };
  }

  revalidatePath("/admin/brokers");

  return {
    ok: true,
    message: wantsLogin
      ? `${name} can sign in at /admin/login. Give them this password — it is shown once.`
      : `${name} added. They can be assigned leads but cannot sign in.`,
    tempPassword: password,
  };
}

/** Revoking access is a flag, never a delete: the broker's name has to keep
 *  resolving on every lead they ever worked. */
export async function setBrokerActive(
  _prev: BrokerFormState,
  formData: FormData,
): Promise<BrokerFormState> {
  const admin = await requireRole("admin");
  const sb = supabaseAdmin();

  const id = String(formData.get("broker_id") ?? "");
  const active = formData.get("active") === "true";
  if (!id) return { ok: false, message: "Unknown broker." };

  // Locking yourself out would leave the project with no way back in except the
  // Supabase dashboard.
  if (id === admin.brokerId && !active) {
    return { ok: false, message: "You cannot deactivate your own account." };
  }

  if (!active) {
    const { count } = await sb
      .from("leads")
      .select("id", { count: "exact", head: true })
      .eq("assigned_broker_id", id)
      .not("status", "in", "(won,lost)");

    if ((count ?? 0) > 0) {
      return {
        ok: false,
        message: `Reassign their ${count} open ${count === 1 ? "lead" : "leads"} first — deactivating now would hide those leads from everyone.`,
      };
    }
  }

  const { error } = await sb.from("brokers").update({ is_active: active }).eq("id", id);
  if (error) return { ok: false, message: error.message };

  revalidatePath("/admin/brokers");
  return { ok: true, message: active ? "Access restored." : "Access revoked." };
}
