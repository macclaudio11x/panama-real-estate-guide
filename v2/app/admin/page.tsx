import Link from "next/link";
import { requireAdmin } from "@/lib/admin-auth";
import { LEAD_STATUSES, STATUS_LABEL, listLeads, statusCounts } from "@/lib/crm";
import { supabaseAdmin } from "@/lib/supabase";

/* The overview answers one question — what needs a call today — and then gets
   out of the way. Vanity totals go at the bottom, if anywhere. */

async function articleCounts() {
  const sb = supabaseAdmin();
  const [published, draft] = await Promise.all([
    sb.from("articles").select("id", { count: "exact", head: true }).eq("status", "published"),
    sb.from("articles").select("id", { count: "exact", head: true }).eq("status", "draft"),
  ]);
  return { published: published.count ?? 0, draft: draft.count ?? 0 };
}

export default async function AdminOverview() {
  const user = await requireAdmin();
  const [counts, recent, articles] = await Promise.all([
    statusCounts(),
    listLeads(),
    articleCounts(),
  ]);

  const open = LEAD_STATUSES.filter((s) => s !== "won" && s !== "lost").reduce(
    (n, s) => n + counts[s],
    0,
  );

  return (
    <>
      <h1 className="font-display text-[26px] font-bold text-ink">
        {user.email.split("@")[0]}
      </h1>
      <p className="mt-1.5 text-[15px] text-muted">
        {counts.new === 0
          ? "No new enquiries waiting."
          : `${counts.new} new ${counts.new === 1 ? "enquiry" : "enquiries"} waiting for a first call.`}
      </p>

      <div className="mt-7 grid gap-4 grid-cols-[repeat(auto-fit,minmax(150px,1fr))]">
        {(
          [
            ["New", counts.new, "/admin/leads?status=new"],
            ["Open", open, "/admin/leads"],
            ["Won", counts.won, "/admin/leads?status=won"],
            ["Articles live", articles.published, null],
            ["Drafts", articles.draft, null],
          ] as const
        ).map(([label, value, href]) => {
          const card = (
            <div className="rounded-md border border-line bg-white p-5 h-full">
              <p className="font-display text-[30px] font-bold text-ink leading-none">{value}</p>
              <p className="mt-2 font-mono text-[11px] uppercase tracking-[0.077em] text-muted">
                {label}
              </p>
            </div>
          );
          return href ? (
            <Link key={label} href={href} className="no-underline">
              {card}
            </Link>
          ) : (
            <div key={label}>{card}</div>
          );
        })}
      </div>

      <h2 className="mt-10 font-display text-[18px] font-bold text-ink">Latest enquiries</h2>
      {recent.length === 0 ? (
        <p className="mt-3 text-[15px] text-muted">
          Nothing yet. Submissions from the contact form and the project pages land here.
        </p>
      ) : (
        <ul className="mt-4 flex flex-col gap-2">
          {recent.slice(0, 8).map((lead) => (
            <li key={lead.id}>
              <Link
                href={`/admin/leads/${lead.id}`}
                className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 rounded-md border border-line bg-white px-4 py-3 no-underline hover:border-brand transition-colors"
              >
                <span className="font-display text-[15.5px] font-bold text-ink">
                  {lead.full_name}
                </span>
                <span className="text-[14px] text-muted">
                  {lead.budget_band ?? "budget not given"}
                  {lead.project ? ` · ${lead.project.name}` : ""}
                </span>
                <span className="font-mono text-[11px] uppercase tracking-[0.077em] text-muted">
                  {STATUS_LABEL[lead.status]}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
