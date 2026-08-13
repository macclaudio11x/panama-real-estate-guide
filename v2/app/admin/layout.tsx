import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getAdminUser, signOut } from "@/lib/admin-auth";
import { DocumentShell, documentMetadata } from "@/components/document-shell";
import { AdminNav } from "./nav";
import { AdminSearch } from "./search-box";

export const metadata: Metadata = {
  ...documentMetadata,
  // /admin is its own root layout, so it inherits no title template. `absolute`
  // is kept anyway: it states the intent, and it survives anyone adding a
  // template here later.
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

/* The shell: a grouped sidebar, and a top bar whose only permanent occupant is
   the search box. Search sits here rather than on the leads page because the
   moment it is needed — a number nobody recognises is ringing — you are on
   whatever screen you happened to be on. */

export default async function AdminLayout({
  children,
  drawer,
}: {
  children: React.ReactNode;
  /** The intercepted lead route, or null on every other path. */
  drawer: React.ReactNode;
}) {
  const user = await getAdminUser();

  // The login page renders bare — it is the one admin route without a session.
  // Bare still means inside the document: this is a root layout, so it owes
  // every branch an <html>. The drawer is deliberately dropped here: there is
  // nothing to open it over, and rendering it would leak a lead to a
  // signed-out browser.
  if (!user) return <DocumentShell lang="en">{children}</DocumentShell>;

  const initials = user.name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();

  return (
    <DocumentShell lang="en">
      <div className="flex-1 grid min-[900px]:grid-cols-[224px_minmax(0,1fr)] bg-page">
        <aside className="bg-brand text-white flex flex-col min-[900px]:sticky min-[900px]:top-0 min-[900px]:h-dvh">
          <div className="px-5 pt-6 pb-5">
            <p className="font-display text-[15px] font-bold text-white leading-none">
              Panama<span className="text-accent">.</span>
            </p>
            <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.12em] text-white/45">
              Broker CRM
            </p>
          </div>

          <AdminNav role={user.role} />

          <div className="mt-auto border-t border-white/10 px-5 py-4">
            <div className="flex items-center gap-2.5">
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-accent font-display text-[12px] font-bold text-brand-900">
                {initials || "?"}
              </span>
              <div className="min-w-0">
                <p className="truncate text-[13.5px] font-medium text-white/90">{user.name}</p>
                <p className="font-mono text-[10px] uppercase tracking-[0.077em] text-white/40">
                  {user.role}
                </p>
              </div>
            </div>
            <form action={logoutAction}>
              <button
                type="submit"
                className="mt-3 w-full text-left text-[13px] text-white/55 hover:text-white transition-colors cursor-pointer"
              >
                Sign out
              </button>
            </form>
          </div>
        </aside>

        <div className="min-w-0 flex flex-col">
          <header className="sticky top-0 z-20 flex items-center gap-4 border-b border-line bg-paper/95 backdrop-blur px-[clamp(16px,3vw,32px)] py-3">
            <AdminSearch />
            <Link
              href="/"
              target="_blank"
              className="ml-auto hidden sm:block shrink-0 font-mono text-[11px] uppercase tracking-[0.077em] text-muted no-underline hover:text-brand transition-colors"
            >
              View site ↗
            </Link>
          </header>

          <main className="min-w-0 flex-1 px-[clamp(16px,3vw,32px)] py-[clamp(20px,3vw,32px)]">
            {children}
          </main>
        </div>

        {drawer}
      </div>
    </DocumentShell>
  );
}
