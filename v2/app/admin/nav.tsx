"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { AdminRole } from "@/lib/admin-auth";

/* Grouped so the sidebar reads as two jobs rather than five links: working the
   leads you have, and running the desk. A broker only ever has the first. */

type Item = { href: string; label: string; exact?: boolean; adminOnly?: boolean };

const GROUPS: { title: string; items: Item[] }[] = [
  {
    title: "Desk",
    items: [
      { href: "/admin", label: "Overview", exact: true },
      { href: "/admin/follow-ups", label: "Follow-ups" },
    ],
  },
  {
    title: "Leads",
    items: [
      { href: "/admin/pipeline", label: "Pipeline" },
      { href: "/admin/leads", label: "All leads" },
    ],
  },
  {
    title: "Team",
    items: [{ href: "/admin/brokers", label: "Brokers", adminOnly: true }],
  },
];

export function AdminNav({ role }: { role: AdminRole }) {
  const pathname = usePathname();

  return (
    <nav aria-label="Admin sections" className="flex flex-col gap-5 px-3">
      {GROUPS.map((group) => {
        const items = group.items.filter((i) => !i.adminOnly || role === "admin");
        if (items.length === 0) return null;

        return (
          <div key={group.title}>
            <p className="px-2 pb-1.5 font-mono text-[10px] uppercase tracking-[0.12em] text-white/35">
              {group.title}
            </p>
            <ul className="flex flex-col gap-0.5">
              {items.map((item) => {
                // Without the exact check, "/admin" lights up on every page
                // beneath it and the sidebar always claims you are on Overview.
                const active = item.exact
                  ? pathname === item.href
                  : pathname.startsWith(item.href);

                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      aria-current={active ? "page" : undefined}
                      className={`block rounded-sm px-2 py-1.5 text-[14px] no-underline transition-colors ${
                        active
                          ? "bg-white/12 text-white font-medium"
                          : "text-white/65 hover:bg-white/6 hover:text-white"
                      }`}
                    >
                      {item.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}
    </nav>
  );
}
