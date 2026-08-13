import { requireAdmin } from "@/lib/admin-auth";
import { STALE_AFTER_HOURS, followUps } from "@/lib/crm";
import { EmptyState, LeadListRow, SectionHeading, dueLabel, when } from "../ui";

/* The working screen. Four lists in the order you should clear them: what is
   late, what is due, what nobody ever scheduled, and what is coming.

   "Never picked up" sits above "upcoming" on purpose. A lead sitting at new
   with no follow-up date is the failure this page exists to catch — it is
   invisible on a board and invisible in a date-sorted queue, because it has no
   date to sort by. */

export default async function FollowUpsPage() {
  const user = await requireAdmin();
  const { overdue, today, upcoming, stale } = await followUps(user);

  const nothing = !overdue.length && !today.length && !upcoming.length && !stale.length;

  return (
    <>
      <h1 className="font-display text-[24px] font-bold text-ink">Follow-ups</h1>
      <p className="mt-1 text-[14.5px] text-muted">
        {overdue.length + today.length === 0
          ? "Nothing is due today."
          : `${overdue.length + today.length} to clear today.`}
      </p>

      {nothing ? (
        <div className="mt-6">
          <EmptyState>
            Nothing waiting. New leads appear here once they have been sitting for{" "}
            {STALE_AFTER_HOURS} hours without a follow-up date.
          </EmptyState>
        </div>
      ) : (
        <div className="mt-7 flex flex-col gap-8">
          <Group
            title="Overdue"
            tone="urgent"
            leads={overdue}
            note={(l) => dueLabel(l.next_action_at!)}
          />
          <Group title="Due today" leads={today} />

          <Group
            title="Never picked up"
            tone="urgent"
            leads={stale}
            hint={`still new after ${STALE_AFTER_HOURS}h, with no follow-up booked`}
            note={(l) => `waiting ${when(l.created_at).replace(" ago", "")}`}
          />

          <Group title="Coming up" leads={upcoming} note={(l) => dueLabel(l.next_action_at!)} />
        </div>
      )}
    </>
  );
}

function Group({
  title,
  leads,
  tone = "neutral",
  hint,
  note,
}: {
  title: string;
  leads: Awaited<ReturnType<typeof followUps>>["overdue"];
  tone?: "neutral" | "urgent";
  hint?: string;
  note?: (lead: Awaited<ReturnType<typeof followUps>>["overdue"][number]) => string;
}) {
  if (leads.length === 0) return null;

  return (
    <section>
      <SectionHeading title={title} count={leads.length} tone={tone} hint={hint} />
      <div className="mt-3 flex flex-col gap-2">
        {leads.map((lead) => (
          <LeadListRow key={lead.id} lead={lead} note={note?.(lead)} />
        ))}
      </div>
    </section>
  );
}
