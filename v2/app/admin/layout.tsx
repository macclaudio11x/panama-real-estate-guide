import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getAdminUser, signOut } from "@/lib/admin-auth";

export const metadata: Metadata = {
  // `absolute` opts out of the root layout's "%s | Panama Real Estate Guide"
  // template, which otherwise renders the site name twice in the tab.
  title: { absolute: "Admin — Panama Real Estate Guide" },
  robots: { index: false, follow: false },
};

// Every admin page reads live data. None of it may be prerendered or cached.
export const dynamic = "force-dynamic";

async function logoutAction() {
  "use server";
  await signOut();
  redirect("/admin/login");
}

const navLink =
  "block px-3 py-2 rounded-sm text-[14px] text-white/75 hover:text-white hover:bg-white/10 transition-colors no-underline";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await getAdminUser();

  // The login page renders bare — it is the one admin route without a session.
  if (!user) return <>{children}</>;

  return (
    <div className="flex-1 grid min-[820px]:grid-cols-[220px_minmax(0,1fr)]">
      <aside className="bg-brand text-white px-4 py-6 flex flex-col gap-1">
        <p className="font-display text-[13px] font-bold uppercase tracking-[0.077em] text-accent px-3 mb-4">
          PRG Admin
        </p>
        <Link href="/admin" className={navLink}>
          Overview
        </Link>
        <Link href="/admin/leads" className={navLink}>
          Leads
        </Link>
        <Link href="/" className={navLink} target="_blank">
          View the site ↗
        </Link>

        <form action={logoutAction} className="mt-auto pt-6">
          <p className="px-3 pb-2 font-mono text-[11px] text-white/45 break-all">{user.email}</p>
          <button
            type="submit"
            className="w-full text-left px-3 py-2 rounded-sm text-[14px] text-white/75 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
          >
            Sign out
          </button>
        </form>
      </aside>

      <main className="bg-page px-[clamp(20px,4vw,40px)] py-[clamp(24px,4vw,40px)] min-w-0">
        {children}
      </main>
    </div>
  );
}
