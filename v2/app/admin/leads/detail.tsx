import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/admin-auth";
import { STATUS_LABEL, assignableBrokers, getLead, getLeadEvents } from "@/lib/crm";
import { IntentBadge, StatusPill, dt, dueLabel } from "../ui";
import { AssignForm, LogForm, StatusForm } from "./forms";

/* One lead: who they are, what they want, where they came from, and everything
   anyone has done about it. The timeline is the point — a status alone tells
   you where a lead is but not whether it is being worked.

   Rendered identically by the full page and by the drawer, so the two cannot
   drift. `compact` only changes the layout, never what is shown: a drawer that
   hides fields would make people close it to check the real page. */

function Field({ label, value }: { label: string; value: string | null }) {
  if (!value) return null;
  return (
    <div>
      <dt className="font-mono text-[10.5px] uppercase tracking-[0.077em] text-muted">{label}</dt>
      <dd className="mt-0.5 break-words text-[14.5px] text-body">{value}</dd>
    </div>
  );
}

export async function LeadDetail({ id, compact = false }: { id: string; compact?: boolean }) {
  const user = await requireAdmin();

  // Scoped: a broker asking for someone else's lead gets the same answer as
  // one asking for a lead that does not exist.
  const lead = await getLead(user, id);
  if (!lead) notFound();

  const [events, brokers] = await Promise.all([
    getLeadEvents(id),
    user.role === "admin" ? assignableBrokers() : Promise.resolve([]),
  ]);

  const campaign = [lead.utm_source, lead.utm_medium, lead.utm_campaign]
    .filter(Boolean)
    .join(" · ");

  return (
    <>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
        <h1 className="font-display text-[22px] font-bold text-ink">{lead.full_name}</h1>
        <StatusPill status={lead.status} />
        <span className="font-mono text-[11.5px] text-faint">{lead.reference}</span>
      </div>

      <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1">
        <p className="text-[14px] text-muted">
          Submitted {dt(lead.created_at)} ·{" "}
          {lead.broker ? `assigned to ${lead.broker.name}` : "unassigned"}
        </p>
        <IntentBadge intent={lead.intent} />
      </div>

      {lead.next_action_at && (
        <p className="mt-1 font-mono text-[11px] uppercase tracking-[0.077em] text-accent-700">
          Follow-up {dueLabel(lead.next_action_at)}
        </p>
      )}

      <div
        className={`mt-6 grid items-start gap-6 ${
          compact ? "" : "min-[1080px]:grid-cols-[minmax(0,1fr)_300px]"
        }`}
      >
        <div className="min-w-0">
          <section className="rounded-md border border-line bg-paper p-5">
            <h2 className="font-display text-[15.5px] font-bold text-ink">Enquiry</h2>
            <dl className="mt-3.5 grid grid-cols-[repeat(auto-fit,minmax(140px,1fr))] gap-4">
              <Field label="Email" value={lead.email} />
              <Field label="Phone" value={lead.phone} />
              <Field label="Lives in" value={lead.country} />
              <Field label="Budget" value={lead.budget_band} />
              <Field label="Timeline" value={lead.timeline} />
              <Field label="Financing" value={lead.financing} />
              <Field label="Residency" value={lead.residency_interest} />
              <Field label="Project" value={lead.project?.name ?? null} />
              <Field label="Area" value={lead.area?.name ?? null} />
            </dl>

            {lead.notes && (
              <div className="mt-5 border-t border-line pt-4">
                <p className="font-mono text-[10.5px] uppercase tracking-[0.077em] text-muted">
                  What they wrote
                </p>
                <p className="mt-1.5 whitespace-pre-line text-[15px] leading-relaxed text-body">
                  {lead.notes}
                </p>
              </div>
            )}

            {lead.email && (
              <a
                href={`mailto:${lead.email}?subject=${encodeURIComponent(
                  `Your Panama property enquiry (${lead.reference})`,
                )}`}
                className="mt-5 inline-block rounded-sm border border-line px-4 py-2 font-display text-[14px] font-bold text-brand no-underline transition-colors hover:border-brand"
              >
                Email {lead.full_name.split(" ")[0]}
              </a>
            )}
          </section>

          <section className="mt-5 rounded-md border border-line bg-paper p-5">
            <h2 className="font-display text-[15.5px] font-bold text-ink">Where it came from</h2>
            <dl className="mt-3.5 grid grid-cols-[repeat(auto-fit,minmax(140px,1fr))] gap-4">
              <Field label="Page" value={lead.page_path} />
              <Field label="Campaign" value={campaign || null} />
              <Field label="Referrer" value={lead.referrer} />
              <Field label="Google click" value={lead.gclid} />
              <Field label="Meta click" value={lead.fbclid} />
              <Field label="Consented" value={dt(lead.consented_at)} />
            </dl>
            {!campaign && !lead.referrer && !lead.page_path && (
              <p className="mt-3 text-[14px] text-muted">
                No attribution captured — the submission carried no campaign or referrer.
              </p>
            )}
          </section>

          <section className="mt-5">
            <h2 className="font-display text-[15.5px] font-bold text-ink">Activity</h2>
            <ol className="mt-3 flex flex-col gap-2">
              {events.map((e) => (
                <li key={e.id} className="rounded-md border border-line bg-paper px-4 py-3">
                  <p className="font-mono text-[10.5px] uppercase tracking-[0.077em] text-muted">
                    {e.kind === "status_change"
                      ? `${e.from_status ? STATUS_LABEL[e.from_status] : "—"} → ${
                          e.to_status ? STATUS_LABEL[e.to_status] : "—"
                        }`
                      : e.kind}
                    <span className="text-faint"> · {dt(e.created_at)}</span>
                    {e.actor_email && <span className="text-faint"> · {e.actor_email}</span>}
                  </p>
                  {e.body && (
                    <p className="mt-1.5 whitespace-pre-line text-[14.5px] leading-relaxed text-body">
                      {e.body}
                    </p>
                  )}
                </li>
              ))}
            </ol>
          </section>
        </div>

        <aside
          className={`flex flex-col gap-5 ${
            compact ? "" : "min-[1080px]:sticky min-[1080px]:top-20"
          }`}
        >
          <StatusForm lead={lead} />
          {user.role === "admin" && <AssignForm lead={lead} brokers={brokers} />}
          <LogForm lead={lead} />
        </aside>
      </div>
    </>
  );
}
