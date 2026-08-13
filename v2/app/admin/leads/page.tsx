import Link from "next/link";
import { requireAdmin } from "@/lib/admin-auth";
import { LEAD_STATUSES, STATUS_LABEL, listLeads, type LeadStatus } from "@/lib/crm";
import type { LeadIntent } from "@/lib/leads";
import { EmptyState, IntentBadge, StatusPill, source, when } from "../ui";

/* The inbox. Sorted newest first because a lead's value decays by the hour,
   and showing where it came from because "which guide produced this buyer" is
   the question the attribution columns exist to answer. */

function isStatus(v: string | undefined): v is LeadStatus {
  return !!v && (LEAD_STATUSES as readonly string[]).includes(v);
}

const INTENTS = ["shortlist", "project", "article"] as const;
function isIntent(v: string | undefined): v is LeadIntent {
  return !!v && (INTENTS as readonly string[]).includes(v);
}

const chip =
  "inline-flex items-center rounded-sm border px-2.5 py-1 font-mono text-[10.5px] uppercase tracking-[0.077em] no-underline transition-colors";
const chipOn = "border-brand bg-brand text-white";
const chipOff = "border-line bg-paper text-muted hover:border-brand";

/** Rebuilds the current query string with one key changed, so the status and
 *  intent filters compose instead of clearing each other. */
function href(current: Record<string, string | undefined>, patch: Record<string, string | null>) {
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries({ ...current, ...patch })) {
    if (v) params.set(k, v);
  }
  const qs = params.toString();
  return qs ? `/admin/leads?${qs}` : "/admin/leads";
}

export default async function LeadsInbox({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; intent?: string; pool?: string }>;
}) {
  const user = await requireAdmin();
  const sp = await searchParams;

  const status = isStatus(sp.status) ? sp.status : undefined;
  const intent = isIntent(sp.intent) ? sp.intent : undefined;
  const unassigned = sp.pool === "unassigned" && user.role === "admin";

  const current = { status, intent, pool: unassigned ? "unassigned" : undefined };
  const leads = await listLeads(user, { status, intent, unassigned });

  return (
    <>
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h1 className="font-display text-[24px] font-bold text-ink">
          {user.role === "admin" ? "All leads" : "Your leads"}
        </h1>
        <p className="font-mono text-[11px] uppercase tracking-[0.077em] text-faint">
          {leads.length} shown
        </p>
      </div>

      <nav aria-label="Filter by status" className="mt-4 flex flex-wrap gap-1.5">
        <Link
          href={href(current, { status: null })}
          className={`${chip} ${status ? chipOff : chipOn}`}
        >
          All
        </Link>
        {LEAD_STATUSES.map((s) => (
          <Link
            key={s}
            href={href(current, { status: s })}
            className={`${chip} ${status === s ? chipOn : chipOff}`}
          >
            {STATUS_LABEL[s]}
          </Link>
        ))}
      </nav>

      <nav aria-label="Filter by source" className="mt-2 flex flex-wrap gap-1.5">
        {INTENTS.map((i) => (
          <Link
            key={i}
            href={href(current, { intent: intent === i ? null : i })}
            className={`${chip} ${intent === i ? chipOn : chipOff}`}
          >
            {i === "article" ? "From a guide" : i === "project" ? "From a project" : "Full form"}
          </Link>
        ))}
        {user.role === "admin" && (
          <Link
            href={href(current, { pool: unassigned ? null : "unassigned" })}
            className={`${chip} ${unassigned ? chipOn : chipOff}`}
          >
            Unassigned
          </Link>
        )}
      </nav>

      {leads.length === 0 ? (
        <div className="mt-6">
          <EmptyState>
            {status || intent || unassigned
              ? "No leads match that filter."
              : user.role === "admin"
                ? "No leads yet. Submissions from the contact form and the project pages land here."
                : "Nothing assigned to you yet."}
          </EmptyState>
        </div>
      ) : (
        <div className="mt-5 overflow-x-auto rounded-md border border-line bg-paper">
          <table className="w-full border-collapse text-[14px]">
            <thead>
              <tr className="border-b border-line text-left">
                {["Name", "Contact", "Looking for", "Came from", "Owner", "Status", ""].map((h) => (
                  <th
                    key={h}
                    className="whitespace-nowrap px-4 py-3 font-mono text-[10.5px] font-normal uppercase tracking-[0.077em] text-muted"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {leads.map((lead) => (
                <tr key={lead.id} className="border-b border-line-soft align-top last:border-b-0">
                  <td className="px-4 py-3">
                    <Link
                      href={`/admin/leads/${lead.id}`}
                      className="font-display font-bold text-ink no-underline hover:text-brand"
                    >
                      {lead.full_name}
                    </Link>
                    <div className="mt-1">
                      <IntentBadge intent={lead.intent} />
                    </div>
                    <p className="mt-0.5 font-mono text-[10.5px] text-faint">{lead.reference}</p>
                  </td>

                  <td className="px-4 py-3 text-body">
                    {lead.email && <span className="block break-all">{lead.email}</span>}
                    {lead.phone && <span className="block text-muted">{lead.phone}</span>}
                  </td>

                  <td className="whitespace-nowrap px-4 py-3 text-body">
                    {lead.budget_band ?? "—"}
                    <span className="block text-muted">{lead.timeline ?? "—"}</span>
                  </td>

                  <td className="px-4 py-3 text-muted">
                    {source(lead)}
                    {lead.utm_campaign && (
                      <span className="block font-mono text-[10.5px] text-faint">
                        {lead.utm_source ?? "?"} · {lead.utm_campaign}
                      </span>
                    )}
                  </td>

                  <td className="whitespace-nowrap px-4 py-3 text-[13.5px]">
                    {lead.broker?.name ?? (
                      <span className="text-accent-700">unassigned</span>
                    )}
                  </td>

                  <td className="px-4 py-3">
                    <StatusPill status={lead.status} />
                  </td>

                  <td className="whitespace-nowrap px-4 py-3 text-right font-mono text-[10.5px] text-faint">
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
