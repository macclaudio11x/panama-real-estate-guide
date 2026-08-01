import { redirect } from "next/navigation";
import { getAdminUser, signIn } from "@/lib/admin-auth";

async function loginAction(formData: FormData) {
  "use server";
  const result = await signIn(
    String(formData.get("email") ?? ""),
    String(formData.get("password") ?? ""),
  );
  if (result.ok) redirect("/admin");
  redirect(`/admin/login?error=${encodeURIComponent(result.error)}`);
}

const field =
  "w-full rounded-sm border border-line bg-white px-3.5 py-2.5 text-[16px] text-body focus:border-brand outline-none";
const label =
  "block font-display text-[12px] font-bold uppercase tracking-[0.077em] text-ink mb-2";

export default async function AdminLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  if (await getAdminUser()) redirect("/admin");
  const { error } = await searchParams;

  return (
    <div className="flex-1 grid place-items-center bg-page px-5 py-16">
      <div className="w-full max-w-[380px] rounded-md border border-line bg-white shadow-md p-7">
        <h1 className="font-display text-[22px] font-bold text-ink">Admin</h1>
        <p className="mt-1.5 text-[14.5px] text-muted">
          Panama Real Estate Guide
        </p>

        {error && (
          <p
            role="alert"
            className="mt-5 rounded-sm border border-line border-l-[3px] border-l-negative bg-paper-warm px-3.5 py-2.5 text-[14px] text-body"
          >
            {error}
          </p>
        )}

        <form action={loginAction} className="mt-6 flex flex-col gap-4">
          <div>
            <label className={label} htmlFor="email">
              Email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              required
              autoComplete="username"
              className={field}
            />
          </div>
          <div>
            <label className={label} htmlFor="password">
              Password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              required
              autoComplete="current-password"
              className={field}
            />
          </div>
          <button
            type="submit"
            className="mt-1 font-display text-[16px] font-bold px-6 py-3 rounded-sm bg-accent text-brand-900 hover:bg-accent-600 hover:text-white transition-colors cursor-pointer"
          >
            Sign in
          </button>
        </form>
      </div>
    </div>
  );
}
