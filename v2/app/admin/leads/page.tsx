import Link from "next/link";
import { requireAdmin } from "@/lib/admin-auth";
import { LEAD_STATUSES, STATUS_LABEL, type LeadStatus, listLeads } from "@/lib/crm";

/* The inbox. Sorted newest first because a lead's value decays by the hour,
   and showing where it came from because "which guide produced this buyer" is
   the question the attribution columns exist to answer. */

function isStatus(v: string | undefined): v is LeadStatus {
  return !!v && (LEAD_STATUSES as readonly string[]).includes(v);
}

function when(iso: string): string {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 60) return `${Math.max(mins, 0)}m ago`;
  if (mins < 60 * 24) return `${Math.floor(mins / 60)}h ago`;
  const days = Math.floor(mins / (60 * 24));
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

const chip =
  "inline-flex items-center rounded-sm border px-2.5 py-1 font-mono text-[11px] uppercase tracking-[0.077em] no-underline transition-colors";

export default async function LeadsInbox({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  await requireAdmin();
  const { status } = await searchParams;
  const active = isStatus(status) ? status : undefined;
  const leads = await listLeads(active);

  return (
    <>
      <h1 className="font-display text-[26px] font-bold text-ink">Leads</h1>

      <nav className="mt-5 flex flex-wrap gap-2">
        <Link
          href="/admin/leads"
          className={`${chip} ${
            active ? "border-line bg-white text-muted hover:border-brand" : "border-brand bg-brand text-white"
          }`}
        >
          All
        </Link>
        {LEAD_STATUSES.map((s) => (
          <Link
            key={s}
            href={`/admin/leads?status=${s}`}
            className={`${chip} ${
              active === s
                ? "border-brand bg-brand text-white"
                : "border-line bg-white text-muted hover:border-brand"
            }`}
          >
            {STATUS_LABEL[s]}
          </Link>
        ))}
      </nav>

      {leads.length === 0 ? (
        <p className="mt-8 text-[15px] text-muted">
          {active
            ? `No leads at “${STATUS_LABEL[active]}”.`
            : "No leads yet. Submissions from the contact form and the project pages land here."}
        </p>
      ) : (
        <div className="mt-6 overflow-x-auto rounded-md border border-line bg-white">
          <table className="w-full border-collapse text-[14.5px]">
            <thead>
              <tr className="border-b border-line text-left">
                {["Name", "Contact", "Looking for", "Came from", "Status", ""].map((h) => (
                  <th
                    key={h}
                    className="px-4 py-3 font-mono text-[11px] font-normal uppercase tracking-[0.077em] text-muted whitespace-nowrap"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {leads.map((lead) => (
                <tr key={lead.id} className="border-b border-line-soft last:border-b-0 align-top">
                  <td className="px-4 py-3">
                    <Link
                      href={`/admin/leads/${lead.id}`}
                      className="font-display font-bold text-ink no-underline hover:text-brand"
                    >
                      {lead.full_name}
                    </Link>
                    {/* Without this a guide request reads as a buyer who
                        couldn't be bothered to fill the form in: same row, same
                        empty budget and timeline. They were told nobody would
                        call, so the queue has to say so before someone dials. */}
                    {lead.intent === "brief" && (
                      <span className="mt-1 block w-fit rounded-sm border border-line bg-paper-warm px-1.5 py-px font-mono text-[10px] uppercase tracking-[0.077em] text-muted">
                        Guides only · no call
                      </span>
                    )}
                    <p className="mt-0.5 font-mono text-[11px] text-faint">{lead.reference}</p>
                  </td>
                  <td className="px-4 py-3 text-body">
                    {lead.email && <span className="block break-all">{lead.email}</span>}
                    {lead.phone && <span className="block text-muted">{lead.phone}</span>}
                  </td>
                  <td className="px-4 py-3 text-body whitespace-nowrap">
                    {lead.budget_band ?? "—"}
                    <span className="block text-muted">{lead.timeline ?? "—"}</span>
                  </td>
                  <td className="px-4 py-3 text-muted">
                    {lead.project?.name ?? lead.area?.name ?? lead.page_path ?? "—"}
                    {lead.utm_campaign && (
                      <span className="block font-mono text-[11px] text-faint">
                        {lead.utm_source ?? "?"} · {lead.utm_campaign}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span className="font-mono text-[11px] uppercase tracking-[0.077em] text-muted">
                      {STATUS_LABEL[lead.status]}
                    </span>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-right font-mono text-[11px] text-faint">
                    {when(lead.created_at)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
