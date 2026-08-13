import Link from "next/link";
import { requireAdmin } from "@/lib/admin-auth";
import { LEAD_STATUSES, followUps, listLeads, statusCounts } from "@/lib/crm";
import { EmptyState, LeadListRow, SectionHeading, dueLabel } from "./ui";

/* The overview answers one question — what needs a call today — and then gets
   out of the way. Vanity totals go at the bottom, if anywhere. */

export default async function AdminOverview() {
  const user = await requireAdmin();

  const [counts, recent, queue] = await Promise.all([
    statusCounts(user),
    listLeads(user),
    followUps(user),
  ]);

  const open = LEAD_STATUSES.filter((s) => s !== "won" && s !== "lost").reduce(
    (n, s) => n + counts[s],
    0,
  );

  const needsWork = [...queue.overdue, ...queue.today, ...queue.stale];
  const unassigned = user.role === "admin" ? recent.filter((l) => !l.assigned_broker_id) : [];

  return (
    <>
      <h1 className="font-display text-[24px] font-bold text-ink">
        {user.name.split(" ")[0]}
      </h1>
      <p className="mt-1 text-[14.5px] text-muted">
        {needsWork.length === 0
          ? counts.new === 0
            ? "Nothing waiting."
            : `${counts.new} new ${counts.new === 1 ? "enquiry" : "enquiries"} to open.`
          : `${needsWork.length} ${needsWork.length === 1 ? "lead needs" : "leads need"} you today.`}
      </p>

      <div className="mt-6 grid grid-cols-[repeat(auto-fit,minmax(140px,1fr))] gap-3">
        {(
          [
            ["New", counts.new, "/admin/leads?status=new"],
            ["Open", open, "/admin/pipeline"],
            ["Overdue", queue.overdue.length, "/admin/follow-ups"],
            ["Never picked up", queue.stale.length, "/admin/follow-ups"],
            ["Won", counts.won, "/admin/leads?status=won"],
          ] as const
        ).map(([label, value, href]) => (
          <Link key={label} href={href} className="no-underline">
            <div className="h-full rounded-md border border-line bg-paper p-4 transition-colors hover:border-brand">
              <p className="font-display text-[28px] font-bold leading-none text-ink">{value}</p>
              <p className="mt-1.5 font-mono text-[10.5px] uppercase tracking-[0.077em] text-muted">
                {label}
              </p>
            </div>
          </Link>
        ))}
      </div>

      {needsWork.length > 0 && (
        <section className="mt-9">
          <SectionHeading
            title="Needs you today"
            count={needsWork.length}
            tone="urgent"
            hint="overdue, due today, or never picked up"
          />
          <div className="mt-3 flex flex-col gap-2">
            {needsWork.slice(0, 8).map((lead) => (
              <LeadListRow
                key={lead.id}
                lead={lead}
                note={lead.next_action_at ? dueLabel(lead.next_action_at) : "never worked"}
              />
            ))}
          </div>
          {needsWork.length > 8 && (
            <Link
              href="/admin/follow-ups"
              className="mt-3 inline-block font-mono text-[11px] uppercase tracking-[0.077em] text-brand no-underline hover:underline"
            >
              All {needsWork.length} →
            </Link>
          )}
        </section>
      )}

      {unassigned.length > 0 && (
        <section className="mt-9">
          <SectionHeading
            title="Waiting for an owner"
            count={unassigned.length}
            tone="urgent"
            hint="nobody has been given these"
          />
          <div className="mt-3 flex flex-col gap-2">
            {unassigned.slice(0, 6).map((lead) => (
              <LeadListRow key={lead.id} lead={lead} />
            ))}
          </div>
          {unassigned.length > 6 && (
            <Link
              href="/admin/leads?pool=unassigned"
              className="mt-3 inline-block font-mono text-[11px] uppercase tracking-[0.077em] text-brand no-underline hover:underline"
            >
              All {unassigned.length} →
            </Link>
          )}
        </section>
      )}

      <section className="mt-9">
        <SectionHeading title="Latest enquiries" count={recent.length} />
        <div className="mt-3">
          {recent.length === 0 ? (
            <EmptyState>
              Nothing yet. Submissions from the contact form and the project pages land here.
            </EmptyState>
          ) : (
            <div className="flex flex-col gap-2">
              {recent.slice(0, 6).map((lead) => (
                <LeadListRow key={lead.id} lead={lead} />
              ))}
            </div>
          )}
        </div>
      </section>
    </>
  );
}
